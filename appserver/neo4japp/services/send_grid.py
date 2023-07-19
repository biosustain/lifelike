from flask import g

from neo4japp.utils.globals import config


def get_send_grid_service():
    if 'send_grid' not in g:
        from sendgrid import SendGridAPIClient

        g.send_grid = SendGridAPIClient(config.get('MAILING_API_KEY'))
    return g.send_grid
