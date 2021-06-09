# LMDB

## What is it?
[LMDB](http://www.lmdb.tech/doc/) is a memory mapped database that is used to store key terms for our annotation pipeline.

## How does it work?

We load LMDB files (data.mdb) into our application, which means our LMDB database lives right besides our application which uses it. The complexity here is in getting the LMDB files to the correct absolute location so our annotation pipeline application can use it.

## How is it setup?

1. A developer curates contents for a LMDB file.
2. A developer stores that content into a cloud storage.
3. A developer creates the actual LMDB (*data.mdb*) file.
4. **Important:** A developer must use the **Flask CLI** command *flask upload-lmdb* in the `app.py` file located under the [appserver](../../../appserver/app.py) directory.
   - To perform this, be sure all of the following steps have been performed before running `flask upload-lmdb`
       1. The repository https://github.com/SBRG/kg-prototypes is pulled locally
       2. The LMDB files are placed in their proper path. The current categories are loaded into the following path: `appserver/services/annotations/lmdb/<category>/data.mdb`

    - We need to do this since Azure Blob Storage does not generate checksums automatically when someone uploads a file, but we need the checksums in order for our automated LMDB update script to pull the correct file versions.
    - **Other Notes:** This action requires access to Azure, so be sure you have access.
5. After the LMDB files are loaded into Azure Blob Storage, the Ansible playbook `deploy-gcloud.yml` will automatically run `docker-compose exec -d -T appserver flask load-lmdb` to pull the LMDB files into the proper location for the Flask application.

## Helpful Notes
1. Running the upload locally can be painfully slow if your using home internet. One way around this is to either use an existing virtual machine on Google or Azure to upload the files. To perform this same action on the virtual machine, be sure to setup the virtual machine to have the Azure CLI installed. You may then retrieve the repository via `git clone https://github.com/SBRG/kg-prototypes`. Load the new LMDB file into the proper directory and run `flask upload-lmdb`.