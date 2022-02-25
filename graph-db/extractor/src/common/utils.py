import os
import zipfile
import git
from config.config import Config


def file_compress(inp_file_names, out_zip_file):
    """
    function : file_compress
    args : inp_file_names : list of filenames to be zipped
    out_zip_file : output zip file
    return : none
    assumption : Input file paths and this code is in same directory.
    """
    # Select the compression mode ZIP_DEFLATED for compression
    # or zipfile.ZIP_STORED to just store the file
    compression = zipfile.ZIP_DEFLATED
    zf = zipfile.ZipFile(out_zip_file, mode='w', strict_timestamps=False)

    try:
        for file_to_write in inp_file_names:
            zf.write(file_to_write, file_to_write, compress_type=compression)
    except FileNotFoundError as e:
        print(f' *** Exception occurred during zip process - {e}')
    finally:
        zf.close()


def get_git_version(short: int = None):
    repo = git.Repo(search_parent_directories=True)
    sha = repo.head.commit.hexsha
    if short:
        return repo.git.rev_parse(sha, short=short)
    else:
        return sha


def get_node_version(data_source_version):
    git_commit_sha = get_git_version(7)
    return f"etl:{git_commit_sha};source:{data_source_version}"


def write_compressed_tsv_file_from_dataframe(
    dataframe, tsv_filename, outdir, zip_file=True
):
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(
        outdir, tsv_filename.replace('.tsv', '.zip') if zip_file else tsv_filename
    )
    compression_opts = (
        dict(method='zip', archive_name=tsv_filename) if zip_file else None
    )
    dataframe.to_csv(path, sep='\t', index=False, compression=compression_opts)


def get_data_dir():
    return Config().data_dir