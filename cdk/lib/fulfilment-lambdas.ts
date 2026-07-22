import { GuApiGatewayWithLambdaByPath } from '@guardian/cdk';
import { GuAlarm } from '@guardian/cdk/lib/constructs/cloudwatch';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { GuS3Bucket } from '@guardian/cdk/lib/constructs/s3';
import type { App } from 'aws-cdk-lib';
import { Duration, Fn } from 'aws-cdk-lib';
import {
	ComparisonOperator,
	MathExpression,
	Metric,
	TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Rule, RuleTargetInput, Schedule } from 'aws-cdk-lib/aws-events';
import {
	LambdaFunction as LambdaTarget,
	SfnStateMachine,
} from 'aws-cdk-lib/aws-events-targets';
import {
	AnyPrincipal,
	Effect,
	PolicyDocument,
	PolicyStatement,
	Role,
	ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { FilterPattern, LogGroup, MetricFilter } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { DefinitionBody, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';

const APP = 'fulfilment-lambdas';
const ALARM_PROCESS =
	'Follow the process in https://docs.google.com/document/d/1_3El3cly9d7u_jPgTcRjLxmdG2e919zCLvmcFCLOYAk/edit';
const ALARM_URGENT = 'URGENT 9-5 -';

/**
 * fulfilment-lambdas, migrated from the hand-written CloudFormation template in
 * cloudformation/cloudformation.yaml to idiomatic Guardian CDK (@guardian/cdk).
 *
 * Stateful and externally-referenced resources keep their existing CloudFormation
 * logical id (via GuStack.overrideLogicalId) so CloudFormation updates them in place:
 * the S3 buckets, the shared lambda role, the RestApi (so the invoke URL the Salesforce
 * UI calls does not change) and the lambdas themselves.
 *
 * The reverting-deployment bug is fixed structurally: the API is now a guCDK
 * GuApiGatewayWithLambdaByPath, whose underlying L2 RestApi manages its own hash-based
 * deployment, so the stage can no longer drift back to an old deployment.
 */
export class FulfilmentLambdas extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);
		const isProd = this.stage === 'PROD';

		const logsBucketName = `fulfilment-s3-logs-${this.stage.toLowerCase()}`;
		const exportBucketName = `fulfilment-export-${this.stage.toLowerCase()}`;

		// --- S3 buckets -----------------------------------------------------
		const accessLogBucket = new GuS3Bucket(this, 'FulfilmentAccessLogBucket', {
			app: APP,
			bucketName: logsBucketName,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			versioned: true,
		});
		this.keep(accessLogBucket, 'FulfilmentAccessLogBucket');

		const fulfilmentBucket = new GuS3Bucket(this, 'FulfilmentBucket', {
			app: APP,
			bucketName: exportBucketName,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			serverAccessLogsBucket: accessLogBucket,
			serverAccessLogsPrefix: `fulfilment-salesforce-backup-_${this.stage}/`,
			versioned: true,
			lifecycleRules: [
				{ id: 'DeleteAllOldFiles', prefix: '', expiration: Duration.days(365) },
				{
					id: 'DeleteOldFilesZuora',
					prefix: 'zuora',
					expiration: Duration.days(14),
				},
			],
		});
		this.keep(fulfilmentBucket, 'FulfilmentBucket');

		const denyUnencrypted = (sid: string, condition: Record<string, unknown>) =>
			new PolicyStatement({
				sid,
				effect: Effect.DENY,
				principals: [new AnyPrincipal()],
				actions: ['s3:PutObject'],
				resources: [`arn:aws:s3:::${exportBucketName}/*`],
				conditions: condition,
			});
		// Preserve the deny-unencrypted bucket policy.
		fulfilmentBucket.addToResourcePolicy(
			denyUnencrypted('DenyIncorrectEncryptionHeader', {
				StringNotEquals: {
					's3:x-amz-server-side-encryption': ['AES256', 'aws:kms'],
				},
			}),
		);
		fulfilmentBucket.addToResourcePolicy(
			denyUnencrypted('DenyUnEncryptedObjectUploads', {
				Null: { 's3:x-amz-server-side-encryption': 'true' },
			}),
		);
		if (fulfilmentBucket.policy) {
			this.keep(fulfilmentBucket.policy, 'EncryptBucketPolicy');
		}

		// --- Shared lambda role (kept in place) -----------------------------
		const workersRole = new Role(this, 'FulfilmentWorkersLambdaRole', {
			roleName: `FulfilmentWorkers-${this.stage}`,
			assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
			path: '/',
			inlinePolicies: {
				LambdaPolicy: new PolicyDocument({
					statements: [
						new PolicyStatement({
							effect: Effect.ALLOW,
							actions: [
								'logs:CreateLogGroup',
								'logs:CreateLogStream',
								'logs:PutLogEvents',
								'lambda:InvokeFunction',
							],
							resources: ['*'],
						}),
					],
				}),
				PrivateBucket: new PolicyDocument({
					statements: [
						new PolicyStatement({
							effect: Effect.ALLOW,
							actions: ['s3:GetObject'],
							resources: [
								`arn:aws:s3:::gu-reader-revenue-private/membership/fulfilment-lambdas/${this.stage}/*`,
							],
						}),
					],
				}),
				WorkBucket: new PolicyDocument({
					statements: [
						new PolicyStatement({
							effect: Effect.ALLOW,
							actions: [
								's3:AbortMultipartUpload',
								's3:DeleteObject',
								's3:GetObject',
								's3:GetObjectAcl',
								's3:GetBucketAcl',
								's3:ListBucket',
								's3:PutObject',
								's3:GetObjectVersion',
								's3:DeleteObjectVersion',
							],
							resources: [`arn:aws:s3:::${exportBucketName}/*`],
						}),
					],
				}),
				ListWorkBucket: new PolicyDocument({
					statements: [
						new PolicyStatement({
							effect: Effect.ALLOW,
							actions: ['s3:ListBucket'],
							resources: [`arn:aws:s3:::${exportBucketName}`],
						}),
					],
				}),
				CloudWatchMetrics: new PolicyDocument({
					statements: [
						new PolicyStatement({
							effect: Effect.ALLOW,
							actions: ['cloudwatch:PutMetricData'],
							resources: ['*'],
						}),
					],
				}),
			},
		});
		this.keep(workersRole, 'FulfilmentWorkersLambdaRole');

		// --- Worker lambdas -------------------------------------------------
		const zuoraQuerier = this.worker('ZuoraQuerierLambda', {
			functionName: `zuora_fulfilment_querier-${this.stage}`,
			description: 'Trigger zuora export',
			handler: 'querier.handler',
			role: workersRole,
		});
		const resultsFetcher = this.worker('ResultsFetcherLambda', {
			functionName: `zuora_fulfilment_fetcher-${this.stage}`,
			description: 'Fetch zuora export results',
			handler: 'fetcher.handler',
			role: workersRole,
		});
		const fulfilmentExporter = this.worker('FulfilmentExporterLambda', {
			functionName: `zuora_fulfilment_exporter-${this.stage}`,
			description: 'Fetch generate fulfilment file',
			handler: 'exporter.handler',
			role: workersRole,
		});
		const salesforceDownloader = this.worker('SalesforceDownloaderLambda', {
			functionName: `zuora_fulfilment_salesforce_downloader-${this.stage}`,
			description: 'Fetch salesforce fulfilment files',
			handler: 'salesforce_downloader.handler',
			role: workersRole,
		});
		const weeklyUploader = this.worker('WeeklyUploaderLambda', {
			functionName: `weekly-fulfilmentUploader-${this.stage}`,
			description: 'upload Guardian Weekly fulfilment files to salesforce',
			handler: 'weekly_salesforce_uploader.handler',
			role: workersRole,
		});

		// --- Step Function (kept ASL, L2 construct) -------------------------
		const stateMachine = new StateMachine(this, 'FulfilmentStateMachine', {
			stateMachineName: `fulfilment-state-machine-${this.stage}`,
			timeout: Duration.seconds(64800),
			definitionBody: DefinitionBody.fromString(
				Fn.sub(
					JSON.stringify({
						Comment: 'State machine for Fulfilment',
						TimeoutSeconds: 64800,
						StartAt: 'QueryZuora',
						States: {
							QueryZuora: {
								Type: 'Task',
								Resource: '${querierArn}',
								Next: 'WaitSomeTime',
								Retry: [
									{
										ErrorEquals: ['States.ALL'],
										IntervalSeconds: 30,
										MaxAttempts: 3,
									},
								],
							},
							WaitSomeTime: {
								Type: 'Wait',
								Seconds: 180,
								Next: 'FetchResults',
							},
							FetchResults: {
								Type: 'Task',
								Resource: '${fetcherArn}',
								Next: 'GenerateFulfilmentFile',
								Retry: [
									{
										ErrorEquals: ['States.ALL'],
										IntervalSeconds: 30,
										MaxAttempts: 50,
										BackoffRate: 1.15,
									},
								],
							},
							GenerateFulfilmentFile: {
								Type: 'Task',
								Resource: '${exporterArn}',
								End: true,
								Retry: [
									{
										ErrorEquals: ['States.ALL'],
										IntervalSeconds: 30,
										MaxAttempts: 3,
									},
								],
							},
						},
					}),
					{
						querierArn: zuoraQuerier.functionArn,
						fetcherArn: resultsFetcher.functionArn,
						exporterArn: fulfilmentExporter.functionArn,
					},
				),
			),
		});
		this.keep(stateMachine, 'FulfilmentStateMachine');
		zuoraQuerier.grantInvoke(stateMachine);
		resultsFetcher.grantInvoke(stateMachine);
		fulfilmentExporter.grantInvoke(stateMachine);

		// salesforce_uploader needs the state machine ref in its environment.
		const salesforceUploader = this.worker('SalesforceUploaderLambda', {
			functionName: `salesforce_uploader-${this.stage}`,
			description:
				'Upload Home Delivery fulfilment files to Salesforce document Home_Delivery_Pipeline_Fulfilment',
			handler: 'salesforce_uploader.handler',
			role: workersRole,
			environment: { StateMachine: stateMachine.stateMachineArn },
		});

		// --- Checker lambda + metric filter --------------------------------
		const checkerLambda = this.worker('checkerLambda', {
			functionName: `zuora_fulfilment_checker-${this.stage}`,
			description: 'daily check to verify fulfilment files have been generated',
			handler: 'checker.handler',
			role: workersRole,
			memorySize: 128,
		});

		const checkerLogGroup = LogGroup.fromLogGroupName(
			this,
			'CheckerLogGroup',
			`/aws/lambda/${checkerLambda.functionName}`,
		);
		const metricFilter = new MetricFilter(
			this,
			'fulfilmentCheckerMetricFilter',
			{
				logGroup: checkerLogGroup,
				filterPattern: FilterPattern.literal('"CHECK:PASSED"'),
				metricNamespace: `${this.stage}/fulfilment`,
				metricName: 'fulfilmentFileUpdated',
				metricValue: '1',
			},
		);
		this.keep(metricFilter, 'fulfilmentCheckerMetricFilter');

		// --- EventBridge schedules -----------------------------------------
		const homeDeliveryRule = new Rule(this, 'ScheduledRule', {
			description: 'TriggerFulfilment',
			schedule: Schedule.expression('cron(0 7 ? * mon-fri *)'),
			targets: [1, 2, 3, 4, 5].map(
				(days) =>
					new SfnStateMachine(stateMachine, {
						input: RuleTargetInput.fromObject({
							deliveryDateDaysFromNow: days,
							type: 'homedelivery',
						}),
					}),
			),
		});
		this.keep(homeDeliveryRule, 'ScheduledRule');

		const weeklyRule = new Rule(this, 'WeeklyScheduledRule', {
			description: 'TriggerWeeklyFulfilment',
			schedule: Schedule.expression('cron(00 2 ? * * *)'),
			targets: [
				new SfnStateMachine(stateMachine, {
					input: RuleTargetInput.fromObject({
						type: 'weekly',
						deliveryDayOfWeek: 'friday',
						minDaysInAdvance: 8,
					}),
				}),
			],
		});
		this.keep(weeklyRule, 'WeeklyScheduledRule');

		const weeklyUploadRule = new Rule(this, 'WeeklyScheduledUploadRule', {
			description: 'TriggerWeeklyFulfilmentUpload',
			schedule: Schedule.expression('cron(00 11 ? * THU *)'),
			targets: [
				new LambdaTarget(weeklyUploader, {
					event: RuleTargetInput.fromObject({
						type: 'weekly',
						deliveryDayOfWeek: 'friday',
						minDaysInAdvance: 8,
					}),
				}),
			],
		});
		this.keep(weeklyUploadRule, 'WeeklyScheduledUploadRule');

		const sfDownloadRule = new Rule(this, 'SFDownloadScheduledRule', {
			description: 'Download fulfilment files from Salesforce',
			schedule: Schedule.expression('cron(50 14 ? * mon-fri *)'),
			targets: [new LambdaTarget(salesforceDownloader)],
		});
		this.keep(sfDownloadRule, 'SFDownloadScheduledRule');

		const checkerRule = new Rule(this, 'CheckerScheduledRule', {
			description: 'trigger fulfilment file check',
			schedule: Schedule.expression('cron(30 11 * * ? *)'),
			targets: [new LambdaTarget(checkerLambda)],
		});
		this.keep(checkerRule, 'CheckerScheduledRule');

		// --- API Gateway (the fix: L2 RestApi auto-manages redeployment) ----
		const apiPattern = new GuApiGatewayWithLambdaByPath(this, {
			app: APP,
			restApiName: `fulfilment-api-${this.stage}`,
			description:
				'Upload Home Delivery fulfilment files to Salesforce document Home_Delivery_Pipeline_Fulfilment',
			deployOptions: { stageName: this.stage },
			monitoringConfiguration: { noMonitoring: true },
			targets: [
				{ path: '/fulfilment', httpMethod: 'POST', lambda: salesforceUploader },
			],
		});
		// Keep the RestApi in place so its physical id (and invoke URL) is preserved.
		this.keep(apiPattern.api, 'FulfilmentAPI');
		// Keep the existing stage's logical id too, so CloudFormation updates the stage in
		// place (just repointing its DeploymentId) instead of trying to create a second
		// stage with the same name — which would clash on the same RestApi.
		this.keep(apiPattern.api.deploymentStage, 'FulfilmentAPIStage');
		// Same reasoning for the /fulfilment resource and its POST method: without keeping
		// their logical ids, CloudFormation creates the new ones before deleting the old,
		// and the API rejects a second resource/method with the same path on the same API.
		const proxyResource = apiPattern.api.root.resourceForPath('/fulfilment');
		this.keep(proxyResource, 'FulfilmentProxyResource');
		const proxyMethod = proxyResource.node.tryFindChild('POST');
		if (proxyMethod) {
			this.keep(proxyMethod, 'FulfilmentMethod');
		}

		// --- Alarms ---------------------------------------------------------
		if (isProd) {
			this.buildProdAlarms(weeklyUploader);
		}
		this.buildDataQualityAlarms();
	}

	/** Force an existing CloudFormation logical id so the resource is updated in place. */
	private keep(
		construct: Parameters<GuStack['overrideLogicalId']>[0],
		logicalId: string,
	): void {
		this.overrideLogicalId(construct, {
			logicalId,
			reason:
				'Retaining a resource previously defined in the hand-written CloudFormation',
		});
	}

	private worker(
		logicalId: string,
		props: {
			functionName: string;
			description: string;
			handler: string;
			role: Role;
			memorySize?: number;
			environment?: Record<string, string>;
		},
	): GuLambdaFunction {
		const lambda = new GuLambdaFunction(this, logicalId, {
			app: APP,
			fileName: `${APP}.zip`,
			functionName: props.functionName,
			description: props.description,
			handler: props.handler,
			runtime: Runtime.NODEJS_22_X,
			memorySize: props.memorySize ?? 512,
			timeout: Duration.seconds(300),
			loggingFormat: LoggingFormat.TEXT,
			role: props.role,
			environment: { Stage: this.stage, ...props.environment },
		});
		this.keep(lambda, logicalId);
		return lambda;
	}

	private snsTopicName(): string {
		return `alarms-handler-topic-${this.stage}`;
	}

	private urgent(suffix: string): string {
		return `${ALARM_URGENT} ${this.stage} ${suffix}`;
	}

	private buildProdAlarms(weeklyUploader: GuLambdaFunction): void {
		// No SNS action in the original template — keep it action-free.
		const checkerAlarm = new GuAlarm(this, 'CheckerAlarm', {
			app: APP,
			snsTopicName: this.snsTopicName(),
			actionsEnabled: false,
			alarmName: `fulfilment_check_alarm_${this.stage}`,
			alarmDescription: 'alarm when fulfilment file has not been generated',
			metric: new Metric({
				namespace: `${this.stage}/fulfilment`,
				metricName: 'fulfilmentFileUpdated',
				statistic: 'Sum',
				period: Duration.seconds(86400),
			}),
			comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
			threshold: 1,
			evaluationPeriods: 1,
			treatMissingData: TreatMissingData.BREACHING,
		});
		this.keep(checkerAlarm, 'CheckerAlarm');

		const sfnAlarm = new GuAlarm(this, 'FulfilmentStateMachineAlarm', {
			app: APP,
			snsTopicName: this.snsTopicName(),
			alarmName: this.urgent('Failed to generate GW and HD fulfilment files'),
			alarmDescription: `Impact - Guardian Weekly and Home Delivery subscribes will not get their paper. Fix FulfilmentStateMachine ASAP! ${ALARM_PROCESS}`,
			metric: new Metric({
				namespace: 'AWS/States',
				metricName: 'ExecutionsFailed',
				statistic: 'Sum',
				period: Duration.seconds(60),
				dimensionsMap: { StateMachineArn: Fn.ref('FulfilmentStateMachine') },
			}),
			comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
			threshold: 1,
			evaluationPeriods: 1,
			treatMissingData: TreatMissingData.IGNORE,
		});
		this.keep(sfnAlarm, 'FulfilmentStateMachineAlarm');

		const apiAlarm = new GuAlarm(
			this,
			'HomeDeliveryUploadToSalesforceApiAlarm',
			{
				app: APP,
				snsTopicName: this.snsTopicName(),
				alarmName: this.urgent(
					'Failed to upload Home Delivery fulfilment files to Salesforce',
				),
				alarmDescription: `Impact - Home Delivery subscribers will not get their paper. Investigate fulfilment-api Gateway ASAP!  ${ALARM_PROCESS}`,
				metric: new Metric({
					namespace: 'AWS/ApiGateway',
					metricName: '5XXError',
					statistic: 'Sum',
					period: Duration.seconds(60),
					dimensionsMap: {
						ApiName: `fulfilment-api-${this.stage}`,
						Stage: this.stage,
					},
				}),
				comparisonOperator:
					ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
				threshold: 1,
				evaluationPeriods: 1,
				treatMissingData: TreatMissingData.NOT_BREACHING,
			},
		);
		this.keep(apiAlarm, 'HomeDeliveryUploadToSalesforceApiAlarm');

		const gwAlarm = new GuAlarm(
			this,
			'GuardianWeeklyUploadToSalesforceLambdaAlarm',
			{
				app: APP,
				snsTopicName: this.snsTopicName(),
				alarmName: this.urgent(
					'Failed to upload Guardian Weekly fulfilment files to Salesforce',
				),
				alarmDescription: `Impact - Guardian Weekly subscribers will not get their paper. Investigate weekly-fulfilmentUploader ASAP!  ${ALARM_PROCESS}`,
				metric: weeklyUploader.metricErrors({
					period: Duration.seconds(60),
					statistic: 'Sum',
				}),
				comparisonOperator:
					ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
				threshold: 1,
				evaluationPeriods: 1,
				treatMissingData: TreatMissingData.NOT_BREACHING,
			},
		);
		this.keep(gwAlarm, 'GuardianWeeklyUploadToSalesforceLambdaAlarm');

		this.missingFieldAlarm('MissingDeliveryAgentAlarm', {
			suffix: 'Fulfilment files have missing delivery agent information',
			impact:
				'Impact - Customers may not receive their newspapers due to missing delivery agent. Investigate fulfilment data ASAP!',
			errorType: 'MissingDeliveryAgent',
		});
		this.missingFieldAlarm('MissingAddressAlarm', {
			suffix: 'Fulfilment files have missing address information',
			impact:
				'Impact - Customers may not receive their newspapers due to missing address. Investigate fulfilment data ASAP!',
			errorType: 'MissingAddress',
		});
		this.missingFieldAlarm('MissingPostcodeAlarm', {
			suffix: 'Fulfilment files have missing postcode information',
			impact:
				'Impact - Customers may not receive their newspapers due to missing postcode. Investigate fulfilment data ASAP!',
			errorType: 'MissingPostcode',
		});
		this.missingFieldAlarm('MissingNameAlarm', {
			suffix: 'Fulfilment files have missing customer name information',
			impact:
				'Impact - Customers may not receive their newspapers due to missing name. Investigate fulfilment data ASAP!',
			errorType: 'MissingName',
		});
	}

	private missingFieldAlarm(
		logicalId: string,
		props: { suffix: string; impact: string; errorType: string },
	): void {
		const alarm = new GuAlarm(this, logicalId, {
			app: APP,
			snsTopicName: this.snsTopicName(),
			alarmName: this.urgent(props.suffix),
			alarmDescription: `${props.impact} ${ALARM_PROCESS}`,
			metric: new Metric({
				namespace: 'fulfilment-lambdas',
				metricName: 'ValidationError',
				statistic: 'Sum',
				period: Duration.seconds(300),
				dimensionsMap: {
					Stage: this.stage,
					FulfilmentType: 'homedelivery',
					ErrorType: props.errorType,
				},
			}),
			comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
			threshold: 0,
			evaluationPeriods: 1,
			treatMissingData: TreatMissingData.NOT_BREACHING,
		});
		this.keep(alarm, logicalId);
	}

	private buildDataQualityAlarms(): void {
		this.dataQualityAlarm('HomeDeliveryDataQualityCompositeAlarm', {
			suffix: 'Home Delivery Data Quality Issues Detected',
			product: 'Home Delivery',
			fulfilmentType: 'homedelivery',
			errorTypes: [
				'MissingAddress',
				'MissingCity',
				'MissingPostcode',
				'MissingName',
			],
		});
		this.dataQualityAlarm('GuardianWeeklyDataQualityCompositeAlarm', {
			suffix: 'Guardian Weekly Data Quality Issues Detected',
			product: 'Guardian Weekly',
			fulfilmentType: 'weekly',
			errorTypes: [
				'MissingAddress',
				'MissingCity',
				'MissingCountry',
				'MissingPostcode',
			],
		});
	}

	private dataQualityAlarm(
		logicalId: string,
		props: {
			suffix: string;
			product: string;
			fulfilmentType: string;
			errorTypes: string[];
		},
	): void {
		const usingMetrics = Object.fromEntries(
			props.errorTypes.map((errorType, i) => [
				`m${i + 1}`,
				new Metric({
					namespace: 'fulfilment-lambdas',
					metricName: 'ValidationError',
					statistic: 'Sum',
					period: Duration.seconds(300),
					dimensionsMap: {
						Stage: this.stage,
						FulfilmentType: props.fulfilmentType,
						ErrorType: errorType,
					},
				}),
			]),
		);
		const expression = props.errorTypes.map((_, i) => `m${i + 1}`).join('+');

		const alarm = new GuAlarm(this, logicalId, {
			app: APP,
			snsTopicName: this.snsTopicName(),
			alarmName: this.urgent(props.suffix),
			alarmDescription: `${props.product} fulfilment data has quality issues that may prevent newspaper delivery. Check the ValidationError metrics and the exporter logs. ${ALARM_PROCESS}`,
			metric: new MathExpression({
				expression,
				usingMetrics,
				label: 'Total Data Quality Errors',
				period: Duration.seconds(300),
			}),
			comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
			threshold: 0,
			evaluationPeriods: 1,
			treatMissingData: TreatMissingData.NOT_BREACHING,
		});
		this.keep(alarm, logicalId);
	}
}
