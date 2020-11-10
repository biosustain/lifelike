import os

from io import StringIO
from pathlib import Path


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


"""Use to move processed over to processed folder.
Since can't finish all in one day..."""


def main():
    mem_file = StringIO()
    data_csv = os.path.join(directory, 'abstracts/data-1602546717626.csv')

    with open(data_csv, 'r') as data_file:
        for line in data_file:
            try:
                split_line = line.replace('\n', '').split(',')
                file_path = split_line[1].replace('"', '')
                pmcid = split_line[3].replace('"', '')
            except (IndexError, Exception):
                print(f'Bad line {line}')
                continue

            processed_file_path = os.path.join(directory, f'processed/{pmcid}.dict.txt')
            processed_file = Path(processed_file_path)

            if not processed_file.is_file():
                # hasn't been processed so add it to file
                print(line.replace('\n', ''), file=mem_file)

    with open(data_csv, 'w') as data_file:
        # overwrite with what's left to be processed
        print(mem_file.getvalue(), file=data_file)


if __name__ == '__main__':
    main()
