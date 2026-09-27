# Signed Git Commits on macOS

This guide configures SSH signing so Git signs your commits automatically. The signing key and shell setup stay on your computer; **never commit or share your private key or its passphrase**.

Git signs a commit when you create it. Pushing only uploads that already-created commit, so the key must be unlocked before you run `git commit`.

## 1. Create or choose an SSH signing key

If you already have an SSH signing key, use its paths in the steps below. Do not replace or overwrite an existing key.

To create a dedicated key, choose a filename that does not already exist and run:

```zsh
ssh-keygen -t ed25519 -C "Git commit signing" -f "$HOME/.ssh/id_ed25519_git_signing"
```

Set a passphrase when prompted. The private key is the file without `.pub`; the `.pub` file is safe to register with GitHub.

## 2. Register the public key with GitHub

Copy the public key:

```zsh
pbcopy < "$HOME/.ssh/id_ed25519_git_signing.pub"
```

On GitHub, open **Settings → SSH and GPG keys → New SSH key**, choose **Signing Key** as the key type, paste the public key, and save it. GitHub needs this public key to verify signatures from the matching private key.

## 3. Enable macOS Keychain for GitHub SSH

Create or edit `~/.ssh/config` and add:

```sshconfig
Host github.com
  AddKeysToAgent yes
  UseKeychain yes
```

Protect the SSH config file:

```zsh
chmod 600 "$HOME/.ssh/config"
```

## 4. Add a one-command key loader

Add this function to `~/.zshrc`, replacing the path if your key has a different filename:

```zsh
setupSigning() {
  ssh-add --apple-use-keychain "$HOME/.ssh/id_ed25519_git_signing"
}
```

Load the updated shell configuration and unlock the key:

```zsh
source ~/.zshrc
setupSigning
```

Enter the key passphrase when prompted. macOS Keychain stores it so you generally only need to unlock the key once per login session. **Do not put the passphrase in `.zshrc`.**

## 5. Tell Git to sign commits

From the repository where you want signing enabled, run:

```zsh
git config --local gpg.format ssh
git config --local user.signingkey "$HOME/.ssh/id_ed25519_git_signing.pub"
git config --local commit.gpgsign true
```

These settings apply only to this repository. To enable signing for all repositories, use `--global` instead of `--local`, and make sure the same key is registered with GitHub.

## 6. Verify, commit, and push

Check that Git has the expected settings and that the key is loaded:

```zsh
git config --show-origin --get commit.gpgsign
git config --show-origin --get gpg.format
git config --show-origin --get user.signingkey
ssh-add -l
```

Then create the commit and push as usual:

```zsh
git add <files>
git commit -m "category: describe the change"
git push
```

The commit signature is created by `git commit`; `git push` sends the signed commit to the remote.

## If signing fails

- **Passphrase rejected:** retry carefully; the passphrase is for the private key, not your GitHub password.
- **No identities:** run `setupSigning` and enter the key passphrase.
- **GitHub shows “unverified”:** confirm the matching `.pub` key is registered on GitHub as a **Signing Key**, and that Git's `user.signingkey` points to it.
- **Wrong key or path:** inspect the three `git config --show-origin` values above; update `user.signingkey` to the matching public-key path.
- **This repository has signing disabled:** run `git config --local commit.gpgsign true`.
