FROM fedora:32 as base

# Install dependencies
RUN dnf install htop postgresql graphviz python-pip python3-devel \
    which wget libX11-xcb java-latest-openjdk.x86_64 pandoc texlive-collection-latexextra \
    texlive-scheme-small texlive-collection-xetex texlive-collection-fontsrecommended \
    texlive-collection-genericrecommended -y \
    && dnf groupinstall 'Development Tools' -y \
    && dnf clean packages

RUN wget https://download.documentfoundation.org/libreoffice/stable/7.1.3/rpm/x86_64/LibreOffice_7.1.3_Linux_x86-64_rpm.tar.gz
RUN tar -xvf LibreOffice_*_Linux_x86-64_rpm.tar.gz
RUN cd LibreOffice_*_Linux_x86-64_rpm && dnf install -y RPMS/*.rpm

COPY Module1.xba /opt/libreoffice7.1/presets/basic/Standard/
COPY registrymodifications.xcu .config/libreoffice/4/user

RUN pip install pipenv

ENV N4J_USER n4j
ENV N4J_HOME /home/$N4J_USER
ENV UID 1000
ENV GID 1000

# User and group creation
RUN groupadd -g $GID $N4J_USER && \
    useradd -u $UID -g $GID -G wheel --create-home --home-dir $N4J_HOME --shell /bin/bash $N4J_USER

WORKDIR $N4J_HOME

# Copy Pipfiles and install dependencies FIRST to better apply Docker layer cache
COPY --chown=1000:1000 Pipfile .
COPY --chown=1000:1000 Pipfile.lock .
RUN pipenv install --dev --deploy --system

# ...then copy everything else
COPY --chown=1000:1000 . .

# TODO: We should consider breaking this apart into dev and prod
# builds, so we don't build unnecessary packages

# Don't lose stdin, stdout and stderr output due to buffering
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH $N4J_HOME

RUN echo 'alias python=python3' >> ~/.bashrc && source ~/.bashrc

USER $N4J_USER

CMD [ "bin/startup.sh" ]
