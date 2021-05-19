# Filesystem

The filesystem has the following goals:

* Support any file type
* Extensible behavior per-file type
* Support files within folders and even files within files or folders within files
* Retain the file type as metadata, irrespective of the file extension
* Fully support all Unicode characters in metadata
* Prevent duplicate filenames within the same folder
* Allow sharing on a per-file, per-folder, and per-project basis
* Support read, write, and commenting permissions
* Deduplicate file content
* Support soft deletion of all files
* Database-level consistency checks whenever possible (i.e. for duplicate filename protection)

## Data Modal

Originally, each file type was stored in its own respective table (PDF files in a table for PDF files, map files in a table for map files, etc.) and folders were stored in a separate directories folder. To generate a file listing for a folder, every table would be queried and the results would be merged together. This architecture developed because originally there was not necessarily an intention to create a filesystem, but it created significant issues because all basic file functionality (renaming, moving, copying, etc.) had to be re-implemented for each existing and new file type.

In a major refactor of the filesystem, both files and folders were joined into one table and together both files and folders were then on referred to "objects" and  stored exactly alike. The only difference between a file and a folder is that a folder has the mime type of `vnd.***ARANGO_DB_NAME***.filesystem/directory`, which greatly simplified system design and hastened the process of developing the refactor.

## Projects

Projects are sort of an alias for a folder: a project points to one folder and the project itself has a name and description.

Project names must be globally unique. This restriction is due to (1) project names being a part of the URL for projects and (2) it was decided that it would be less confusing to users if no two projects were named the same.

Only alphanumeric and dash characters are permitted in project names because project names are used in URLs.

After the major refactor, project names became changeable but renaming a project breaks the existing URL to the project. Because projects are really aliases to folders, the URL for the ***ARANGO_USERNAME*** folder essentially serves the same purpose as the project link without the link breaking in the future (because the folder link uses the folder's ID), but Lifelike still uses project-name based URLs in many places.

## File Deletion

Files can be deleted in two stages:

1. To the trash can (recycling_date)
2. Soft deleted (deletion_date)
3. Removed from the database

While files can be trash can'd, that feature is not yet exposed to the user because a trash can page has not been developed. Instead, all files that are deleted jump directly to the "soft deletion" step.

