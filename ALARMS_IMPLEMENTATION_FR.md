# Lambdas de Fulfilment - Plan d'Implémentation des Alarmes de Qualité de Données

## Contexte
Suite à l'incident de juillet 2025 où des informations manquantes sur les livreurs ont affecté 21 clients pendant 6 jours sans détection, nous devons ajouter des alarmes pour détecter les données critiques manquantes ou invalides dans les fichiers de fulfilment.

## Cause Racine
- **Champ Manquant**: Les informations du livreur n'étaient pas présentes dans les données
- **Lacune de Détection**: Aucune validation ou alerte pour détecter ce problème
- **Temps de Détection**: 6 jours (du 16 au 22 juillet)
- **Impact**: 15 clients ont manqué des livraisons, 4 abonnements annulés

## Statut de l'Implémentation

###  ✅ Terminé
1. **Utilitaire de Métriques CloudWatch** - `src/lib/cloudwatch.ts`
   - Module réutilisable pour publier des métriques
   - Suit les patterns Guardian de support-service-lambdas
   - Fonctions: `putMetric()`, `putValidationError()`, `putRowsProcessed()`

2. **Permissions IAM** - `cloudformation/cloudformation.yaml`
   - Ajout de la politique `CloudWatchMetrics` à `FulfilmentWorkersLambdaRole`
   - Autorise l'action `cloudwatch:PutMetricData`

3. **Champ Delivery Agent** - `src/homedelivery/query.ts`
   - Ajout de `SoldToContact.DeliveryAgent__c` à la requête ZOQL Zuora
   - Champ maintenant inclus dans les données exportées

4. **Logique de Validation** - `src/homedelivery/export.ts`
   - Ajout de compteurs de validation pour tous les champs critiques
   - Valide: delivery agent, adresse, code postal, nom du client
   - Enregistre des avertissements pour chaque erreur de validation avec l'ID d'abonnement
   - Publie des métriques après la fin du traitement CSV

5. **Alarmes CloudWatch** - `cloudformation/cloudformation.yaml`
   - Ajout de 4 alarmes (lignes 714-836):
     - `MissingDeliveryAgentAlarm` - Alarme critique liée à l'incident
     - `MissingAddressAlarm` - Validation d'adresse manquante
     - `MissingPostcodeAlarm` - Validation de code postal manquant
     - `MissingNameAlarm` - Validation de nom client manquant
   - Toutes les alarmes se déclenchent sur un seuil > 0 erreurs
   - Configurées pour PROD uniquement avec `alarms-handler-topic`

### 🔄 Prochaines Étapes

#### Tests ⏳
1. **Tests Locaux**:
   - Ajouter des données mock avec delivery agent manquant
   - Exécuter `pnpm run:hd:exporter`
   - Vérifier que les métriques sont publiées (consulter la console CloudWatch)

2. **Tests CODE**:
   - Déployer sur CODE
   - Déclencher la step function manuellement
   - Vérifier les métriques CloudWatch: namespace `fulfilment-lambdas`
   - Vérifier que les alarmes ne se déclenchent pas pour des données valides
   - Tester avec des données invalides pour confirmer le déclenchement des alarmes

3. **Déploiement PROD**:
   - Déployer après des tests CODE réussis
   - Surveiller pendant 1 semaine
   - Ajuster les seuils si nécessaire en fonction des données réelles

## Questions à Répondre

1. **Quel est le nom du champ Zuora pour delivery agent?**
   - ✅ Résolu: `SoldToContact.DeliveryAgent__c`

2. **Quels sont les nombres typiques de lignes pour Home Delivery?**
   - Nécessaire pour définir le seuil de `LowRowCountAlarm`
   - Devrait être ~80% de la moyenne historique

3. **Devons-nous faire échouer l'export si des champs critiques sont manquants?**
   - Actuellement: Non (juste logger et alerter)
   - Alternative: Échouer rapidement et empêcher les mauvaises données d'atteindre Salesforce

4. **Avons-nous besoin d'une validation similaire pour Guardian Weekly?**
   - Oui, mais delivery agent peut ne pas être pertinent pour Weekly
   - Se concentrer sur les champs d'adresse

## Fichiers Modifiés

- ✅ `src/lib/cloudwatch.ts` - NOUVEAU - Utilitaire de métriques CloudWatch
- ✅ `cloudformation/cloudformation.yaml` - Politique IAM + 4 alarmes ajoutées (lignes 171-177, 714-836)
- ✅ `src/homedelivery/export.ts` - Logique de validation et publication de métriques terminée
- ✅ `src/homedelivery/query.ts` - Champ delivery agent ajouté à la requête Zuora
- ⏳ `src/weekly/export.ts` - Futur: Ajouter une validation similaire pour Guardian Weekly

## Critères de Succès

✅ Les alarmes se déclenchent dans les 5 minutes lorsque des données critiques sont manquantes
✅ L'équipe platform reçoit des alertes via `alarms-handler-topic`
✅ Aucun faux positif en PROD pendant 1 semaine
✅ Temps de détection réduit de 6 jours à < 5 minutes
✅ Les alarmes incluent des informations exploitables (quel champ, combien de lignes)

## Documents Connexes

- Rétrospective d'Incident: [Google Doc](https://docs.google.com/document/d/1Bs9YFEjAgZpsEmd8XOiQFLd33qYCGE-2Yju4JHJ9AQQ/edit?tab=t.0)
- Processus d'Alarme: https://docs.google.com/document/d/1_3El3cly9d7u_jPgTcRjLxmdG2e919zCLvmcFCLOYAk/edit
- Guardian Alarm Handler: `/Users/admin.olivier.andrade/Downloads/support-service-lambdas/cdk/lib/alarms-handler.ts`
