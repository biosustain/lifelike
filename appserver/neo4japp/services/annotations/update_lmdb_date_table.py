import sys

from datetime import datetime
from getopt import getopt, GetoptError

from neo4japp.database import db
from neo4japp.models import LMDBsDates

from app import app


def main(argv):
    opts, args = getopt(argv, 'an:')
    opt, entity_type = opts[0]

    lmdbs = [
        'chemicals',
        'compounds',
        'diseases',
        'genes',
        'phenotypes',
        'proteins',
        'species',
    ]

    with app.app_context():
        if opt == '-a':
            for lmdb in lmdbs:
                lmdb_date = LMDBsDates(name=lmdb, date=datetime.utcnow())
                db.session.add(lmdb_date)
            db.session.commit()
        elif opt == '-n':
            lmdb_date = LMDBsDates(name=entity_type, date=datetime.utcnow())
            db.session.add(lmdb_date)
            db.session.commit()


if __name__ == '__main__':
    main(sys.argv[1:])
