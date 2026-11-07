# Sealed letters

Each folder here is one personal invitation letter, encrypted. Nothing in this folder is readable: every page holds only
AES-256-GCM ciphertext, and each letter has its own random key. The key travels only in the link's `#k=` fragment,
which browsers never send to a server, so GitHub, this repo, its history and GitHub Pages never see it. Opened without
the key, a page says only "This letter opens only from the link in your email."

The plain letters, the keys and the links stay with the stewards (the Invitations tab of the nominations sheet), never
here. `assets/` holds the shared look (envelope, seal, paper, cards), which carries no people data. Rebuilt by the
letter builder; never edit these folders by hand.
