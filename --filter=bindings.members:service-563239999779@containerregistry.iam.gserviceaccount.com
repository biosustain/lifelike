bindings:
- members:
  - user:dbour@eng.ucsd.edu
  role: roles/billing.projectManager
- members:
  - user:michaelsiu.sd@gmail.com
  role: roles/browser
- members:
  - serviceAccount:563239999779@cloudbuild.gserviceaccount.com
  role: roles/cloudbuild.builds.builder
- members:
  - serviceAccount:service-563239999779@gcp-sa-cloudbuild.iam.gserviceaccount.com
  role: roles/cloudbuild.serviceAgent
- members:
  - serviceAccount:service-563239999779@gcf-admin-robot.iam.gserviceaccount.com
  role: roles/cloudfunctions.serviceAgent
- members:
  - serviceAccount:githubactions@able-goods-221820.iam.gserviceaccount.com
  - user:Skitionek@gmail.com
  - user:annsirunian@gmail.com
  - user:b4vu@eng.ucsd.edu
  - user:dbour@eng.ucsd.edu
  - user:e4sanchez@eng.ucsd.edu
  - user:michaelsiu.sd@gmail.com
  role: roles/cloudkms.cryptoKeyEncrypterDecrypter
- members:
  - serviceAccount:service-563239999779@gcp-sa-cloudscheduler.iam.gserviceaccount.com
  role: roles/cloudscheduler.serviceAgent
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  - serviceAccount:reconbot@able-goods-221820.iam.gserviceaccount.com
  role: roles/cloudsql.admin
- members:
  - serviceAccount:cloudtasks@able-goods-221820.iam.gserviceaccount.com
  role: roles/cloudtasks.enqueuer
- members:
  - serviceAccount:service-563239999779@gcp-sa-cloudtasks.iam.gserviceaccount.com
  role: roles/cloudtasks.serviceAgent
- members:
  - serviceAccount:cloudtasks@able-goods-221820.iam.gserviceaccount.com
  role: roles/cloudtasks.taskRunner
- members:
  - serviceAccount:cloudtasks@able-goods-221820.iam.gserviceaccount.com
  role: roles/cloudtasks.viewer
- members:
  - serviceAccount:stackdriver-logging@able-goods-221820.iam.gserviceaccount.com
  role: roles/cloudtrace.agent
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  - user:thoeridtu@gmail.com
  role: roles/compute.admin
- members:
  - serviceAccount:githubactions@able-goods-221820.iam.gserviceaccount.com
  role: roles/compute.instanceAdmin.v1
- members:
  - serviceAccount:service-563239999779@compute-system.iam.gserviceaccount.com
  role: roles/compute.serviceAgent
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  role: roles/compute.storageAdmin
- members:
  - serviceAccount:service-563239999779@container-engine-robot.iam.gserviceaccount.com
  role: roles/container.serviceAgent
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  - serviceAccount:service-563239999779@containerregistry.iam.gserviceaccount.com
  role: roles/containerregistry.ServiceAgent
- members:
  - serviceAccount:dataflow@able-goods-221820.iam.gserviceaccount.com
  role: roles/dataflow.admin
- members:
  - serviceAccount:service-563239999779@dataflow-service-producer-prod.iam.gserviceaccount.com
  role: roles/dataflow.serviceAgent
- members:
  - serviceAccount:563239999779-compute@developer.gserviceaccount.com
  - serviceAccount:563239999779@cloudservices.gserviceaccount.com
  - serviceAccount:able-goods-221820@appspot.gserviceaccount.com
  - serviceAccount:service-563239999779@containerregistry.iam.gserviceaccount.com
  - serviceAccount:terraform@able-goods-221820.iam.gserviceaccount.com
  - user:Skitionek@gmail.com
  - user:andrewhuangwp@gmail.com
  - user:annsirunian@gmail.com
  - user:b4vu@eng.ucsd.edu
  - user:dbour@eng.ucsd.edu
  - user:e4sanchez@eng.ucsd.edu
  - user:erenyagdiran@gmail.com
  - user:helloapham@gmail.com
  - user:michaelsiu.sd@gmail.com
  - user:rcai@eng.ucsd.edu
  role: roles/editor
- members:
  - serviceAccount:service-563239999779@cloud-filer.iam.gserviceaccount.com
  role: roles/file.serviceAgent
- members:
  - serviceAccount:firebase-service-account@firebase-sa-management.iam.gserviceaccount.com
  role: roles/firebase.managementServiceAgent
- members:
  - serviceAccount:firebase-adminsdk-newlc@able-goods-221820.iam.gserviceaccount.com
  role: roles/firebase.sdkAdminServiceAgent
- members:
  - serviceAccount:service-563239999779@firebase-rules.iam.gserviceaccount.com
  role: roles/firebaserules.system
- members:
  - serviceAccount:firebase-adminsdk-newlc@able-goods-221820.iam.gserviceaccount.com
  role: roles/iam.serviceAccountTokenCreator
- members:
  - serviceAccount:cloudtasks@able-goods-221820.iam.gserviceaccount.com
  - serviceAccount:githubactions@able-goods-221820.iam.gserviceaccount.com
  - user:thoeridtu@gmail.com
  role: roles/iam.serviceAccountUser
- members:
  - user:b4vu@eng.ucsd.edu
  - user:dbour@eng.ucsd.edu
  - user:e4sanchez@eng.ucsd.edu
  - user:pphaneuf@eng.ucsd.edu
  - user:rcai@eng.ucsd.edu
  role: roles/owner
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  role: roles/pubsub.editor
- members:
  - serviceAccount:pubsub@able-goods-221820.iam.gserviceaccount.com
  role: roles/pubsub.publisher
- members:
  - serviceAccount:service-563239999779@serverless-robot-prod.iam.gserviceaccount.com
  role: roles/run.serviceAgent
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  role: roles/secretmanager.admin
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  - serviceAccount:githubactions@able-goods-221820.iam.gserviceaccount.com
  - serviceAccount:reconbot@able-goods-221820.iam.gserviceaccount.com
  role: roles/storage.admin
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  - serviceAccount:reconbot@able-goods-221820.iam.gserviceaccount.com
  role: roles/storage.objectAdmin
- members:
  - serviceAccount:reconbot@able-goods-221820.iam.gserviceaccount.com
  role: roles/storage.objectCreator
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  - serviceAccount:reconbot@able-goods-221820.iam.gserviceaccount.com
  role: roles/storage.objectViewer
- members:
  - serviceAccount:ansible@able-goods-221820.iam.gserviceaccount.com
  role: roles/storagetransfer.admin
- members:
  - user:michaelsiu.sd@gmail.com
  - user:thoeridtu@gmail.com
  role: roles/viewer
etag: BwW1XSKS6_4=
version: 1
