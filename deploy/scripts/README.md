# Research deployment scripts

## `create-networks.sh`

Creates the three explicitly named research networks if they do not exist.
The script is idempotent and creates `green-aqi-data` as an internal network.

Run it before the first compose deployment:

```bash
./deploy/scripts/create-networks.sh
```
