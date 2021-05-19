import zipfile


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
    zf = zipfile.ZipFile(out_zip_file, mode="w")

    try:
        for file_to_write in inp_file_names:
            zf.write(file_to_write, file_to_write, compress_type=compression)
    except FileNotFoundError as e:
        print(f' *** Exception occurred during zip process - {e}')
    finally:
        zf.close()


