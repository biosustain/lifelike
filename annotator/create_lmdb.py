from app.services.initializer import get_lmdb_service


def main():
    service = get_lmdb_service()
    service.create_lmdb_files()


if __name__ == '__main__':
    main()