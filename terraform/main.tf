provider "random" {}
provider "google" {
    credentials = file("${path.module}/terraform-gcloud.json")
    project = "able-goods-221820"
}

resource "google_compute_instance" "nginx" {
    name = "kg-nginx"
    machine_type = "g1-small"
    zone = "us-central1-c"

    tags = ["http-server", "https-server"]

    boot_disk {
        initialize_params {
            image = "ubuntu-1804-lts"
        }
    }

    connection {
        type = "ssh"
        user = "***ARANGO_USERNAME***"
        private_key = file("~/.ssh/id_rsa")
        agent = false
        host = google_compute_instance.nginx.network_interface.0.access_config.0.nat_ip
    }

    metadata_startup_script = file("${path.module}/gateway-init/bin/set-up-gateway-remote")

    network_interface {
        network = "default"
        access_config {
            // Used for external ip address
            nat_ip = "35.209.241.211"
            network_tier = "STANDARD"
        }
    }

    provisioner "remote-exec" {
        inline = [
            "sudo mkdir -p /docker/letsencrypt-docker-nginx/src/letsencrypt/letsencrypt-site",
            "sudo mkdir -p /docker/letsencrypt-docker-nginx/src/production/production-site",
            "sudo mkdir -p /docker/letsencrypt-docker-nginx/src/production/dh-param"
        ]
    }

    metadata = {
        ssh-keys = "***ARANGO_USERNAME***:${file("~/.ssh/id_rsa.pub")}"
    }

    provisioner "file" {
        source = "./gateway-init/docker-compose.yml"
        destination = "/docker/letsencrypt-docker-nginx/src/letsencrypt/docker-compose.yml"
    }

    provisioner "file" {
        source = "./gateway-init/nginx.conf"
        destination = "/docker/letsencrypt-docker-nginx/src/letsencrypt/nginx.conf"
    }

    provisioner "file" {
        source = "./gateway-init/index.html"
        destination = "/docker/letsencrypt-docker-nginx/src/letsencrypt/letsencrypt-site/index.html"
    }

    provisioner "file" {
        source = "./gateway-init/production/docker-compose.yml"
        destination = "/docker/letsencrypt-docker-nginx/src/production/docker-compose.yml"
    }

    provisioner "file" {
        source = "./gateway-init/production/nginx.conf"
        destination = "/docker/letsencrypt-docker-nginx/src/production/production.conf"
    }
}


resource "google_compute_instance" "appserver" {
    name = "kg-appserver"
    machine_type = "g1-small"
    zone = "us-central1-c"

    boot_disk {
        initialize_params {
            image = "ubuntu-1804-lts"
        }
    }

    network_interface {
        network = "default"
        access_config {
        }
    }

    metadata_startup_script = file("${path.module}/appserver-init/bin/set-up-appserver-remote")
}

resource "random_id" "db_name_suffix" {
    byte_length = 4
}

resource "google_sql_database_instance" "postgres" {
    name = "kg-database-${random_id.db_name_suffix.hex}"
    database_version = "POSTGRES_11"
    region = "us-central1"

    settings {
        tier = "db-f1-micro"
        location_preference {
            zone = "us-central1-c"
        }
        ip_configuration {
            ipv4_enabled = true
            authorized_networks {
                name = google_compute_instance.appserver.name
                value = google_compute_instance.appserver.network_interface.0.access_config.0.nat_ip
            }
        }
        backup_configuration {
            enabled = "true"
            start_time = "03:00"
        }
    }

    provisioner "local-exec" {
        command = templatefile("${path.module}/database-init/bin/update-postgres-secrets", {ipaddr=google_sql_database_instance.postgres.ip_address.0.ip_address})
    }
}

resource "google_compute_instance" "neo4j" {
    name = "kg-n4j"
    machine_type = "g1-small"
    zone = "us-central1-c"

    tags = ["neo4j-server"]

    boot_disk {
        initialize_params {
            image = "ubuntu-1804-lts"
        }
    }

    network_interface {
        network = "default"
        access_config {
        }
    }

    provisioner "local-exec" {
        command = templatefile("${path.module}/database-init/bin/update-neo4j-secrets", {ipaddr=google_compute_instance.neo4j.network_interface.0.access_config.0.nat_ip})
    }

    metadata_startup_script = file("${path.module}/database-init/bin/set-up-n4j")
}
