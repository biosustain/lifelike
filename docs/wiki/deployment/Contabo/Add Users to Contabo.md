# Add Users to Contabo

This document explains the steps required to add a user to the Contabo VPS.

1. Create the User as ***ARANGO_USERNAME***
    - The `-m` option will generate a `/home` directory for the new user.

    `sudo useradd -m <username>`

2. Set the new user's password

    `sudo passwd <username>`

3. Recommended: Add an SSH key to the VM to Bypass Manual Login
    - First, generate an ssh key-pair with a tool like `ssh-keygen`
    - Then, on the VM, complete the following steps:

    ```bash
    cd /home/<username>
    mkdir .ssh
    cd .ssh
    vim authorized_keys
    ```

    - In the text editor, paste in the content of the public key you generated earlier.
    - You should now be able to ssh on to the machine using `ssh -i your-private-key <username>@<ip-address>`
