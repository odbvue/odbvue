-- liquibase formatted sql
-- changeset  SqlCl:1763750201635 stripComments:false logicalFilePath:featsignup\_custom\020_consents.sql
-- sqlcl_snapshot dist\releases\next\changes\featsignup\_custom\020_consents.sql:null:null:custom

SET DEFINE OFF;

MERGE INTO app_consents ac
USING (
    SELECT 'en' AS language_id, 'OdbVue Terms & Conditions' AS name, 1 AS seq, q'[
# OdbVue Demo Application 

## Terms & Conditions

**1. Purpose of the Service**

The OdbVue Demo Application ("the Service") is provided solely for
demonstration, testing, and evaluation of technical capabilities related
to OdbVue technologies. The Service is not intended for production use,
commercial deployment, or handling of critical or sensitive data. By
using the Service, you acknowledge that it is offered strictly for
experimental and informational purposes.

**2. Open-Source Availability**

The underlying OdbVue project is open-source and freely available on
GitHub under the MIT License. The source code can be copied, forked,
modified, redistributed, and incorporated into other projects in
accordance with the MIT License terms. These Terms & Conditions apply
only to the hosted demo service and do not restrict your rights granted
by the MIT License for the open-source project.

**3. No Warranties**

The Service is provided "as is" and "as available," without any
warranties of any kind, whether express or implied. This includes, but
is not limited to, warranties of accuracy, reliability, availability,
performance, fitness for a particular purpose, or non-infringement. The
provider does not guarantee that the Service will function
uninterrupted, be error-free, secure, or meet any specific technical
requirements.

**4. Limitation of Liability**

To the fullest extent permitted by law, the Service provider assumes
zero liability for any damages arising from your access to or use of the
Service. This includes direct, indirect, incidental, consequential, or
special damages related to data loss, corruption, system issues,
downtime, or any decisions made using the Service's output. You
acknowledge that you use the demo entirely at your own risk.

**5. User Responsibilities**

You are solely responsible for any information or data you input into
the Service. Because the demo environment is not intended for
confidential, sensitive, or production data, you agree not to upload
such information. You accept that any data you provide may be lost,
modified, deleted, or exposed due to the experimental nature of the
platform.

**6. Modifications and Termination**

The Service provider reserves the right to modify, suspend, or terminate
the Service at any time without notice. These Terms & Conditions may be
updated periodically, and continued use of the Service constitutes
acceptance of the latest version. If you do not agree with any updated
terms, you must stop using the Service.
]' AS content FROM dual
    UNION ALL
    SELECT 'de' AS language_id, 'OdbVue Allgemeine Geschäftsbedingungen' AS name, 2 AS seq, q'[
# OdbVue Demoanwendung 

## Allgemeine Geschäftsbedingungen

**1. Zweck des Dienstes**

Die OdbVue-Demoanwendung („der Dienst") wird ausschließlich zu
Demonstrations-, Test- und Evaluierungszwecken der technischen
Fähigkeiten von OdbVue bereitgestellt. Der Dienst ist nicht für den
produktiven Einsatz, den kommerziellen Betrieb oder die Verarbeitung
vertraulicher oder sensibler Daten vorgesehen. Durch die Nutzung des
Dienstes erkennen Sie an, dass er ausschließlich zu experimentellen und
informativen Zwecken bereitgestellt wird.

**2. Open-Source-Verfügbarkeit**

Das zugrunde liegende OdbVue-Projekt ist Open Source und auf GitHub
unter der MIT-Lizenz frei verfügbar. Der Quellcode darf gemäß den
Bedingungen der MIT-Lizenz kopiert, geforkt, modifiziert, weitergegeben
oder in andere Projekte integriert werden. Diese Allgemeinen
Geschäftsbedingungen gelten nur für den gehosteten Demo-Dienst und
schränken Ihre Rechte aus der MIT-Lizenz nicht ein.

**3. Keine Gewährleistung**

Der Dienst wird „wie besehen" und „wie verfügbar" bereitgestellt, ohne
jegliche ausdrückliche oder stillschweigende Gewährleistung. Dies
umfasst unter anderem Garantien hinsichtlich Genauigkeit,
Zuverlässigkeit, Verfügbarkeit, Leistung, Eignung für einen bestimmten
Zweck oder Nichtverletzung von Rechten. Der Anbieter garantiert nicht,
dass der Dienst ununterbrochen funktioniert, fehlerfrei ist, sicher ist
oder bestimmte technische Anforderungen erfüllt.

**4. Haftungsbeschränkung**

Im größtmöglichen gesetzlich zulässigen Umfang übernimmt der Anbieter
keinerlei Haftung für Schäden, die aus Ihrem Zugriff auf den Dienst oder
dessen Nutzung entstehen. Dies umfasst direkte, indirekte, beiläufige,
Folgeschäden oder besondere Schäden, einschließlich Datenverlust,
Datenbeschädigung, Systemausfällen, Ausfallzeiten oder Entscheidungen,
die auf Ergebnissen des Dienstes basieren. Sie erkennen an, dass Sie die
Demo vollständig auf eigenes Risiko nutzen.

**5. Pflichten des Nutzers**

Sie sind allein verantwortlich für alle Daten oder Informationen, die
Sie in den Dienst eingeben. Da die Demo-Umgebung nicht für vertrauliche,
sensible oder produktionsrelevante Daten bestimmt ist, erklären Sie sich
damit einverstanden, solche Daten nicht einzugeben. Sie akzeptieren,
dass alle eingegebenen Daten aufgrund der experimentellen Natur der
Plattform verloren gehen, verändert, gelöscht oder offengelegt werden
können.

**6. Änderungen und Beendigung**

Der Anbieter behält sich das Recht vor, den Dienst jederzeit ohne
Vorankündigung zu ändern, einzuschränken oder einzustellen. Diese
Allgemeinen Geschäftsbedingungen können regelmäßig aktualisiert werden,
und Ihre fortgesetzte Nutzung des Dienstes stellt die Zustimmung zur
jeweils aktuellen Version dar. Wenn Sie mit den aktualisierten
Bedingungen nicht einverstanden sind, müssen Sie die Nutzung des
Dienstes einstellen.
]' AS content FROM dual
    UNION ALL
    SELECT 'fr' AS language_id, 'OdbVue Conditions Générales' AS name, 3 AS seq, q'[
# OdbVue Application Démonstration 

## Conditions Générales

**1. Objet du Service**

L'application de démonstration OdbVue (« le Service ») est fournie
uniquement à des fins de démonstration, de test et d'évaluation des
capacités techniques des technologies OdbVue. Le Service n'est pas
destiné à un usage en production, à un déploiement commercial ou au
traitement de données sensibles ou critiques. En utilisant le Service,
vous reconnaissez qu'il est fourni strictement à titre expérimental et
informatif.

**2. Disponibilité Open Source**

Le projet OdbVue est open source et librement disponible sur GitHub sous
licence MIT. Le code source peut être copié, forké, modifié, redistribué
ou intégré dans d'autres projets conformément aux conditions de la
licence MIT. Les présentes Conditions Générales s'appliquent uniquement
au service de démonstration hébergé et ne limitent pas les droits qui
vous sont accordés par la licence MIT concernant le projet open source.

**3. Absence de Garantie**

Le Service est fourni « tel quel » et « selon disponibilité », sans
aucune garantie d'aucune sorte, expresse ou implicite. Cela inclut, sans
s'y limiter, les garanties d'exactitude, de fiabilité, de performance,
de disponibilité, d'adéquation à un usage particulier ou d'absence de
contrefaçon. Le fournisseur ne garantit pas que le Service fonctionnera
sans interruption, sans erreur, de manière sécurisée ou qu'il répondra à
des exigences techniques spécifiques.

**4. Limitation de Responsabilité**

Dans toute la mesure permise par la loi, le fournisseur du Service
n'assume aucune responsabilité pour tout dommage résultant de votre
accès au Service ou de son utilisation. Cela inclut les dommages
directs, indirects, accessoires, consécutifs ou spéciaux liés à la perte
de données, la corruption, des interruptions système, des temps d'arrêt
ou toute décision prise sur la base des résultats fournis par le
Service. Vous reconnaissez utiliser cette démonstration entièrement à
vos propres risques.

**5. Responsabilités de l'Utilisateur**

Vous êtes seul responsable de toute information ou donnée que vous
saisissez dans le Service. Comme l'environnement de démonstration n'est
pas destiné à des données confidentielles, sensibles ou liées à la
production, vous acceptez de ne pas soumettre de telles informations.
Vous acceptez également que les données saisies puissent être perdues,
modifiées, supprimées ou exposées en raison de la nature expérimentale
de la plateforme.

**6. Modifications et Résiliation**

Le fournisseur du Service se réserve le droit de modifier, suspendre ou
résilier le Service à tout moment sans préavis. Les présentes Conditions
Générales peuvent être mises à jour périodiquement, et l'utilisation
continue du Service vaut acceptation de la version la plus récente. Si
vous n'acceptez pas les nouvelles conditions, vous devez cesser
d'utiliser le Service.
]' AS content FROM dual
) source ON (ac.language_id = source.language_id AND ac.name = source.name)
WHEN MATCHED THEN
    UPDATE SET
        content = source.content
WHEN NOT MATCHED THEN
    INSERT (
        id,
        language_id,
        name,
        content,
        created,
        active
    ) VALUES (
        LOWER(SYS_GUID()),
        source.language_id,
        source.name,
        source.content,
        SYSTIMESTAMP,
        'Y'
    );






