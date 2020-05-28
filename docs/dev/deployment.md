## Table of Contents
- [Current Infrastructure](#current-infrastructure)
- [How do I deploy to Google Cloud?](#how-do-i-deploy-to-google-cloud)
  - [Important Notes](#important-notes)
- [How do I update the LMDB database?](#how-do-i-update-the-lmdb-database)

# Current Infrastructure
There are currently three VMs
1. kg-prod - https://kg.***ARANGO_DB_NAME***.bio
   **Description**: The production server. This is currently released in an ad-hoc manner.
2. kg-staging - https://test.***ARANGO_DB_NAME***.bio
   **Description**: The staging server for QA to run their manual tests and for developers to run any other test before pushing into production. This will be updated each time someone merges into master on GitHub.
3. kg-demo - http://104.197.221.147/
   **Description**: The demo server is for testing anything in its own sandbox without affecting any other instances.


# How do I deploy to Google Cloud?

All GitHub actions in progress can be viewed here
https://github.com/SBRG/kg-prototypes/actions

__Staging__

Deploying to staging is done automatically through the workflow file in GitHub actions. The build is triggered anytime someone merges into master. The file can be found [here](./../../.github/workflows/staging.yml).

__Demo__
Deploying to demo requires a user to use the "label" function in a pull request. To push a build to demo
1. Make a pull request
2. On the right hand side, select "demo" as the label
3. GitHub actions will now build to demo
4. Unlabel and Re-label to trigger the build again

__Production__
Deploying to production also uses GitHub actions, but the trigger is manual.

To deploy to production, follow these steps
1. Go to the master branch and make sure its updated
```bash
git checkout master && git pull origin master
```
2. Tag the master branch to be used for the production build

*To view all of the current tags*
```bash
git tag --list
```
*To tag the branch for building*
```bash
git tag <some-tag>
```

3. Go to https://github.com/SBRG/kg-prototypes/releases
4. Go to **Draft a new release* or https://github.com/SBRG/kg-prototypes/releases/new
5. Use the tag just created for "tag version" and fill out of the rest of the form
6. Click **Publish Request** and the build will start

## Important Notes
The docker files for each of the servers are located in Google Cloud Bucket under `gs://kg-secrets`. These are used to combine the `appserver (flask)` and the `webserver (nginx+angular bundle)`. These should be updated if the infrastructure ever changes.

To get the files, simply run the following
```bash
gsutil cp gs://kg-secrets/path/to/file path/to/local/drive
```

To upload the new version
```bash
gsutil cp path/from/local/drive gs://kg-secrets/path/to/file
```

There is currently a volume mount that contains the LMDB database. Having the correct path here is important for LMDB to function properly.

# How do I update the LMDB database?

This is a manual step which currently requires a user to ssh into the server and pulls the new images in from the Google Cloud Bucket. The bucket is named *lmdb_database*

A script should already be be in **kg-production** and **kg-staging** so all thats required is to run the `update-lmdb.sh` script to pull in the required data. This should automatically update the LMDB as it is volume mounted.

for example, on **Staging**

```bash
gcloud compute ssh kg-staging --zone us-central1-a --command="sudo ./update-lmdb.sh";
```
