# Research grid configuration

`research-grid.json` is the version-controlled set of OpenWeatherMap query
coordinates used by the Paper 1 collector. These coordinates are research
grid points, not physical monitoring stations.

The collector validates the file at startup and refuses to start unless it
contains exactly 25 uniquely coded points with valid coordinates and complete
version metadata. Future changes to point locations must create a new grid
version rather than silently changing `hcmc-grid-v1` after data collection has
started.
