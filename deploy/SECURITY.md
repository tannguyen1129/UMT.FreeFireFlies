# Research deployment security

## Intended public exposure

Only HTTP/HTTPS may be reachable publicly:

- `80/tcp`
- `443/tcp`

PostgreSQL, MongoDB, Orion-LD, and the collector health endpoint must remain
Docker-internal. The Compose file uses `expose` rather than `ports`, so none of
these service ports is published on the host.

Run the repeatable local validation from the repository root:

```bash
./deploy/scripts/security-check.sh
```

The script deliberately exits non-zero until both SSH requirements are met.

## Hetzner Cloud Firewall

The firewall attached to this server must allow inbound `80/tcp` and
`443/tcp`. Do not allow database, Orion-LD, collector, metrics, or application
ports.

Allow `22/tcp` only from a trusted source IP while bootstrapping. After a VPN
management session has been tested, remove the public SSH rule. Hetzner Cloud
Firewall is an independent control and is not replaced by Docker networking or
a host firewall.

## Safe SSH hardening order

Do not disable root login before completing every step below:

1. Connect this server to the operator's Tailscale network (or WireGuard).
2. Create a named administrative user and add it to the `sudo` group.
3. Install the operator's public SSH key in that user's `authorized_keys`.
4. Open a new VPN-based SSH session and confirm that `sudo -v` succeeds.
5. In a second still-open session, set `PasswordAuthentication no` and
   `PermitRootLogin no` in an SSH server drop-in.
6. Validate with `sshd -t`, reload SSH, and test one more new session.
7. Remove public `22/tcp` from the Hetzner Cloud Firewall.

Keep the original working session open through the final connection test so a
configuration mistake can be reverted without using the Hetzner rescue console.

Example final drop-in content:

```text
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```

Verify the effective configuration rather than only the source file:

```bash
sshd -T | grep -E \
  '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin|pubkeyauthentication)'
```
