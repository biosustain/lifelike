## Table of Contents
- [Current Infrastructure](#current-infrastructure)
- [How do I deploy to Google Cloud?](#how-do-i-deploy-to-google-cloud)
- [How do I update the LMDB database?](#how-do-i-update-the-lmdb-database)
- [How do I update the NLP database (model)?](#how-do-i-update-the-nlp-database-model)
- [How do I rollback to a previous build?](#how-do-i-rollback-to-a-previous-build)
- [Something went wrong.. how do I fix it?](#something-went-wrong-how-do-i-fix-it)
  - [Common issues](#common-issues)

# Current Infrastructure
There are currently three VMs
1. kg-prod - https://kg.lifelike.bio
   **Description**: The production server. This is currently released in an ad-hoc manner.
2. kg-staging - https://test.lifelike.bio
   **Description**: The staging server for QA to run their manual tests and for developers to run any other test before pushing into production. This will be updated each time someone merges into master on GitHub.
3. kg-demo - http://104.197.221.147/ (*this IP is not static and subject to change*)
   **Description**: The demo server is for testing anything in its own sandbox without affecting any other instances.


# How do I deploy to Google Cloud?

All GitHub actions in progress can be viewed here
https://github.com/SBRG/kg-prototypes/actions

__Staging__

Deploying to staging is done automatically through the workflow file in GitHub actions. The build is triggered anytime someone merges into master. The file can be found [here](./../../.github/workflows/staging.yml).

__Demo__
Deploying to demo requires a user to use the "tag" function in a pull request. To push a build to demo
1. Tag your local branch with "demo"
2. Make a pull request
3. GitHub actions will now build to demo
4. Push again and GitHub actions will repeat itself per push

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

# How do I update the LMDB database?

This is a manual step which currently requires a user to ssh into the server and pulls the new files in from the Google Cloud Bucket.

A script should already be be in **kg-production** and **kg-staging** so all thats required is to run the `fetch-new.sh` script to pull in the required data. This should automatically update the LMDB as it is volume mounted. It will normally be found in the `/srv` directory.

for example, on **Staging**

```bash
gcloud compute ssh kg-staging --zone us-central1-a --command="sudo /srv/fetch-new.sh";
```

# How do I update the NLP database (model)?

This is a manual step which currently requires a user to ssh into the server and pulls the new files in from the Google Cloud Bucket.

A script should already be be in **kg-production** and **kg-staging** so all thats required is to run the `fetch-ai-models.sh` script to pull in the required data. This should automatically update the NLP models as it is volume mounted.

```bash
gcloud compute ssh kg-staging --zone us-central1-a --command="sudo ./fetch-ai-models.sh";
```

# How do I rollback to a previous build?

__Overview__
A rollback is when we want to revert the appserver and webserver images back to another version. We tag each Docker image build with the git commit hash which means we know the history of the images.

To perform a rollback, use the script found [here](/deployment/bin/rollback.sh).
```bash
./rollback.sh -t kg-demo -h f7e9086acec83464d7fd633eb5282ddf7c45f34e
```

__Important Notes__
1. The docker-compose files use whatever image that's specified in the `.env` file thats located in the same directory. The `.env` file contains the `GITHUB_HASH` which determines which build to use when running the application.

2. Rollbacks DO NOT change the database in anyway. This means a rollback can potentially break the application as old code might not be compatible with new changes in the database. This should be handled separately.

# Something went wrong.. how do I fix it?
## Common issues
1. Check if the server is out of space
```bash
df -h
```
**example output**
```
tmpfs           696M  1.6M  694M   1% /run
/dev/sda1        97G   30G   68G  31% /
tmpfs           3.4G     0  3.4G   0% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
tmpfs           3.4G     0  3.4G   0% /sys/fs/cgroup
/dev/loop0       55M   55M     0 100% /snap/core18/1705
/dev/loop2       55M   55M     0 100% /snap/core18/1754
/dev/loop4       98M   98M     0 100% /snap/core/9289
/dev/sda15      105M  3.6M  101M   4% /boot/efi
/dev/sdb        196G   13G  184G   7% /mnt/disks/kg-staging-persistent
/dev/loop3      109M  109M     0 100% /snap/google-cloud-sdk/138
/dev/loop1       97M   97M     0 100% /snap/core/9436
/dev/loop5      118M  118M     0 100% /snap/google-cloud-sdk/139
tmpfs           696M     0  696M   0% /run/user/1003
```
**Solution:** Increase the space by going to the google cloud compute engine disks page and increasing the size. This may require a restart of the VM to detect the new space so you'll also have to rerun the startup script for the server.

2. Check if the docker containers are running
```bash
sudo docker ps -a
```
```
CONTAINER ID        IMAGE                                                                                        COMMAND                  CREATED             STATUS              PORTS                                      NAMES
38dc18c1f057        gcr.io/able-goods-221820/kg-appserver-staging:61e1bbce9b456cd04666701caf8e5063bf94e0df       "bin/start-prod"         7 hours ago         Up 7 hours          0.0.0.0:5000->5000/tcp                     srv_appserver_1
4af4ffb32e37        gcr.io/able-goods-221820/kg-cache-service-staging:61e1bbce9b456cd04666701caf8e5063bf94e0df   "python main.py"         7 hours ago         Up 7 hours                                                     srv_cache-invalidator_1
2db9ce065430        gcr.io/able-goods-221820/kg-webserver-staging:61e1bbce9b456cd04666701caf8e5063bf94e0df       "/docker-entrypoint.…"   7 hours ago         Up 7 hours          0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp   srv_webserver_1
2a077575a5c4        redis:6.0.3-alpine                                                                           "docker-entrypoint.s…"   5 days ago          Up 15 hours         6379/tcp                                   srv_redis_1
```
**Solution:** You can restart the services again by going to where the `docker-compose` file is hosted and re-running the startup script

**e.g. for staging**
```bash
cd /srv/
./startup.sh
```
