# Changelog

## 1.0.0 (2026-07-19)


### Features

* add compose file ([decfb4f](https://github.com/cheminfo/elucidation.cheminfo.org/commit/decfb4fd0e442c3051cc2b6b4f5cfd8aa0b6d461))
* **compose:** persist redis to survive restarts ([3e7ed2f](https://github.com/cheminfo/elucidation.cheminfo.org/commit/3e7ed2f49fc735f5eb02ccb7b0c9eac5f98bfa0f))
* **progress:** report worker slots rather than node count ([01cc8d6](https://github.com/cheminfo/elucidation.cheminfo.org/commit/01cc8d6d2430564fc2220c3d7e051b465101b57e))
* **ui:** describe queue and run age in end-user terms ([301d5a0](https://github.com/cheminfo/elucidation.cheminfo.org/commit/301d5a0637395645e94ffd22a594de008612f7f4))
* web interface for SECS structure elucidation ([f853b93](https://github.com/cheminfo/elucidation.cheminfo.org/commit/f853b931d3f4ec24b6f7f0847749a929e4647e84))


### Bug Fixes

* **compose:** add restart policy and enforce resource limits ([29b69a5](https://github.com/cheminfo/elucidation.cheminfo.org/commit/29b69a58582fbecf37ec784a87d04fc4d4fad8eb))
* **compose:** add Traefik loadbalancer port for api service ([11dc2aa](https://github.com/cheminfo/elucidation.cheminfo.org/commit/11dc2aa47e2ee192af453bf0dbe2569a89a1b058))
* **compose:** give redis the capabilities its entrypoint needs ([5c82ebc](https://github.com/cheminfo/elucidation.cheminfo.org/commit/5c82ebc2fddd8b125e418557e331358c62b93b8a))
* **compose:** raise vectordb memory again, it grows on first query ([bf01568](https://github.com/cheminfo/elucidation.cheminfo.org/commit/bf0156880c54d4369d542bacc6954e451ab5b980))
* **compose:** rebalance cores toward the latency of a single run ([a2b7ea3](https://github.com/cheminfo/elucidation.cheminfo.org/commit/a2b7ea3a09d30f82bda2b308be2a5be109a79d6e))
* **compose:** resize memory from measured usage, vectordb was near its limit ([3c6056d](https://github.com/cheminfo/elucidation.cheminfo.org/commit/3c6056d5a93c24d3320a25f29acc8d99f012bee9))
* **compose:** size cpu and memory limits to the actual machine ([68c007f](https://github.com/cheminfo/elucidation.cheminfo.org/commit/68c007f4590ca45b4f0aaa2cb430a5ed1b0781fd))
* **compose:** stop capability-hardening redis, it breaks the entrypoint ([dc5ef13](https://github.com/cheminfo/elucidation.cheminfo.org/commit/dc5ef13de95a884f6baf203e7e3a3c050cd30dcd))
* **compose:** unquote cpus so the files parse ([9f05077](https://github.com/cheminfo/elucidation.cheminfo.org/commit/9f050770f8215cf9e863ec4dd4a8d54a3349efe5))
* **docker:** stop shipping deployment data to the build daemon ([87ae66b](https://github.com/cheminfo/elucidation.cheminfo.org/commit/87ae66b552ba8897afcfbb35f00e4d6a0d43b647))
* **elucidate:** keep showing a running job after a reload ([f3f1203](https://github.com/cheminfo/elucidation.cheminfo.org/commit/f3f1203935bb2a312682912e77273e41ccc0debc))
* **input:** give the drop zone a definite height so the drag overlay renders ([47a919c](https://github.com/cheminfo/elucidation.cheminfo.org/commit/47a919cf74b052521e0259a9472fba17ab7fb38d))
* **traefik:** rate limit submissions only, not the whole API ([5cf3d32](https://github.com/cheminfo/elucidation.cheminfo.org/commit/5cf3d3277dcb5200a770877498641b555b4e4dfe))
