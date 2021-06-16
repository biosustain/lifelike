## Requirements

* Docker
  * Potentially with increased memory and disk space limits if on Windows or Mac OS X
  * Windows users: Get Docker for Windows, not the older Docker Toolbox
* docker-compose
* Git
* Azure account with access to our files
* [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
  * Configured locally with your login: ```az login```
* The source code, preferably downloaded to a directory named `kg-prototypes`
* Windows users:
  * Symbolic link support
  * make

### Systems Running Docker VMs

If you are on a system that runs Docker in a VM (like Windows or Mac OS X), it's recommend that you increase your VM's memory and disk space to a minimum of:

* 8 GB of RAM
* 60 GB of disk space

These are guidelines and you may need more or less disk space and memory allocated.

###  Windows-specific

#### Enabling Symbolic Links

Windows users will encounter problems with symbolic links in the repository. By default, user accounts on Windows do not have permission to create symbolic links and Git is configured to not create links. In that setup, Git creates symbolic links as regular text files containing the path to the linked file, which will **not** work correctly with most tools.

One solution is to give yourself symbolic link privileges and enable symbolic link creation in Git, although this may expand your vulnerability surface. If you are OK with that, [modify your group policy](https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/create-symbolic-links), log out and back into your user, and set `core.symlinks = true` in your local repository's configuration.

#### Make Installation

We use Makefiles for some configuration, but Windows does not ship with make. To install make, we recommend doing so via Chocolatey:

1. Install [Chocolatey](https://chocolatey.org/install).
2. Run `choco install make` in an administrative shell.

## Installation

Run the following in your shell:

```sh
make init
```

The makefile will:

1. Setup Ansible secrets.
2. Set up the Azure credentials (for container registry and blob access).
3. Download the data necessary from Azure cloud to run the app.
4. Build the docker containers.

## Running

After the containers are built, you can start them up with:

```sh
make docker-run
```

There are containers for the Python app server (`appserver`), the Angular app (`client`), PostgreSQL (`pgdatabase`)

### Seeding PostgreSQL

On initial start, the databases will empty so you will need to seed them using the following command:

```sh
docker-compose exec appserver flask seed
```

However, **boot up takes some time** and if you get an error about tables not existing, please try again in a few minutes. If you've waited a while and the error won't go away, something may have failed and the database schema may not have been installed (it gets installed and updated as part of the app server's startup). If that's the case, try inspecting the containers (described below) to identify the cause.

### Seeding NLP

Optional if you are not working with NLP.

```sh
nlp/fetch-ai-models.sh
```

## Inspecting the Containers

You can view the logs of the containers using:

```sh
docker-compose logs -f $container_name
```

For `$container_name`, you have a choice of:

* `appserver` for the Python app
* `client` for the Angular app

## Connecting to the Containers

### PostgreSQL

```sh
docker-compose exec pgdatabase psql -U postgres -h pgdatabase -d postgres
```

### Neo4j

```sh
docker-compose exec database cypher-shell -u neo4j
```

### Generic

To open a shell in any container, use:

```sh
docker-compose exec -u 0 -it $container_name bash
```

## Making Changes and Testing Them

Because your filesystem is mounted to the Docker containers, **you do not have to restart the containers in order for your file changes to apply**.

The client (Angular app) and the app server (Python Flask app) are set to reload automatically when it detects file changes. In some rare cases, this may stop working. If it does, you can simply run the `make docker-run` command again.

## Rebuilding and Restarting

### Restarting

If you need to restart the development environment without rebuilding it, you can just run `make docker-run` again.

### Rebuilding

If you make changes to the configuration of the containers themselves, or you need to rebuild the Docker containers for whatever reason, run `make init` again.

## Shutting Down

You can shut down the containers without deleting the temporary container data with:

```sh
make docker-stop
```

If you need to delete all Docker data, run the following command afterwards:

```sh
make clean
```

| ⚠ Warning                                                    |
| ------------------------------------------------------------ |
| The clean command will not only affect this project -- it will also prune Docker of dangling or down containers used in other projects. |

## IntelliJ IDE Setup

1. Run `yarn install` in the *client* folder.
2. Install the [Makefile support plugin](https://plugins.jetbrains.com/plugin/9333-makefile-support).
   * On Windows, set the make path to `C:\ProgramData\chocolatey\bin\make.exe` in IntelliJ's settings.
3. Import the `appserver/appserver.iml` and `client/client.iml` files by right clicking them and choosing 'Import.'
   - If you are prompted to add Angular support, choose to do so.
4. Under the *File* -> *Project Settings* window, setup the Python interpreter for the appserver module.
5. From the *Make* tool window, run `init` if you haven't yet previously run `make init`. You can also choose to run Docker from this menu.

## Continued Reading

* [[AppServer Development]]
* [[Client Development]]
* [[PostgreSQL Development]]
