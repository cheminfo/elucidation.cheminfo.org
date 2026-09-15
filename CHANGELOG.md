# Changelog

## 1.0.0 (2026-09-15)


### Features

* **about:** one shared About at /about ([e3787f0](https://github.com/cheminfo/elucidation.cheminfo.org/commit/e3787f054defc98f0c7a77307db79a96c916fd02))
* add compose file ([decfb4f](https://github.com/cheminfo/elucidation.cheminfo.org/commit/decfb4fd0e442c3051cc2b6b4f5cfd8aa0b6d461))
* **api:** raise pop_ga to 512, where the usable results are ([3d1a17b](https://github.com/cheminfo/elucidation.cheminfo.org/commit/3d1a17bf900104c53b70d5da31e1a24e667a59bd))
* **compose:** persist redis to survive restarts ([3e7ed2f](https://github.com/cheminfo/elucidation.cheminfo.org/commit/3e7ed2f49fc735f5eb02ccb7b0c9eac5f98bfa0f))
* **deploy:** keep every build addressable so a rollback needs no rebuild ([4922ea7](https://github.com/cheminfo/elucidation.cheminfo.org/commit/4922ea7e6d4414e9d273ff1763063c861db3526b))
* **deploy:** leave deploying to the global script on the server ([97b4998](https://github.com/cheminfo/elucidation.cheminfo.org/commit/97b4998547da7899fd3cab63cab5a29076640163))
* make every page indexable by search engines ([f9eabaa](https://github.com/cheminfo/elucidation.cheminfo.org/commit/f9eabaab1a61aa060a5067a0af1e48d5f9341352))
* prerender through react-cheminfo and serve under a configurable base path ([5ab78f6](https://github.com/cheminfo/elucidation.cheminfo.org/commit/5ab78f61e9fb679f3f0b9823be5217ae250e213f))
* **progress:** drive the bar from a measured duration estimate ([cfd81ed](https://github.com/cheminfo/elucidation.cheminfo.org/commit/cfd81ed73f54c1c5cd7d875dc2d72bdd364288a9))
* **progress:** report worker slots rather than node count ([01cc8d6](https://github.com/cheminfo/elucidation.cheminfo.org/commit/01cc8d6d2430564fc2220c3d7e051b465101b57e))
* **spectrum:** accept a spectrometer folder, and transform a FID on load ([94109b5](https://github.com/cheminfo/elucidation.cheminfo.org/commit/94109b56e497f7ec1a06368b6972ee4d7c1c7a05))
* take react-cheminfo 0.12 and its shared components ([caa92b4](https://github.com/cheminfo/elucidation.cheminfo.org/commit/caa92b4a2fe9bdfa3418a3a2a80eedf5d4c5fc21))
* **ui:** describe queue and run age in end-user terms ([301d5a0](https://github.com/cheminfo/elucidation.cheminfo.org/commit/301d5a0637395645e94ffd22a594de008612f7f4))
* **ui:** give the site the house identity, in purple and amber ([af5a582](https://github.com/cheminfo/elucidation.cheminfo.org/commit/af5a58278a34073b25ee0852fdf354107c8b3349))
* **ui:** put Cite and Tools in the bar, from react-cheminfo ([91ea346](https://github.com/cheminfo/elucidation.cheminfo.org/commit/91ea3462d8fcbf2b6656c37bf8ab9eab43489fbc))
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
* **deps:** take react-cheminfo 0.9.0 ([2ec32f7](https://github.com/cheminfo/elucidation.cheminfo.org/commit/2ec32f737e353060a540ce5a48699d8069e85cc1))
* **docker:** stop shipping deployment data to the build daemon ([87ae66b](https://github.com/cheminfo/elucidation.cheminfo.org/commit/87ae66b552ba8897afcfbb35f00e4d6a0d43b647))
* **elucidate:** keep showing a running job after a reload ([f3f1203](https://github.com/cheminfo/elucidation.cheminfo.org/commit/f3f1203935bb2a312682912e77273e41ccc0debc))
* **input:** give the drop zone a definite height so the drag overlay renders ([47a919c](https://github.com/cheminfo/elucidation.cheminfo.org/commit/47a919cf74b052521e0259a9472fba17ab7fb38d))
* keep the family links below the fold ([8ec2db0](https://github.com/cheminfo/elucidation.cheminfo.org/commit/8ec2db05a852ee5e42dfe8477cbda506b4a61eb2))
* make the analytics id in .env.example a zeroed placeholder ([583d533](https://github.com/cheminfo/elucidation.cheminfo.org/commit/583d533914625f040de928158ea50820a61c545b))
* **runs:** ask for the result before writing a run off as lost ([45bc30a](https://github.com/cheminfo/elucidation.cheminfo.org/commit/45bc30a792717ca0f5cf28accf545bc2e44c4a65))
* **spectrum:** phase a FID with nmr-processing, not with the angles it was stored with ([b64156a](https://github.com/cheminfo/elucidation.cheminfo.org/commit/b64156ace5333cdec7da9bb414e552be58030d67))
* **spectrum:** search a wide first-order angle when phasing a FID ([d07385e](https://github.com/cheminfo/elucidation.cheminfo.org/commit/d07385eae3a2d1d7bfe7d785eef09765c6bd0343))
* **traefik:** rate limit submissions only, not the whole API ([5cf3d32](https://github.com/cheminfo/elucidation.cheminfo.org/commit/5cf3d3277dcb5200a770877498641b555b4e4dfe))
* **ui:** clear the drawn fragment, not only the query ([a7335b0](https://github.com/cheminfo/elucidation.cheminfo.org/commit/a7335b020b84b35fb855f63ab8b86d82dd8a122f))
* **ui:** stop the substructure editor spilling over the candidates ([528d5e5](https://github.com/cheminfo/elucidation.cheminfo.org/commit/528d5e52c58dfd56e6fdd06f3ecdcd3fa6d5c24e))


### Performance Improvements

* **api:** submit the reference client's GA settings, not the paper's ([74440fe](https://github.com/cheminfo/elucidation.cheminfo.org/commit/74440fe9a9ce79c53874c308ba9d87f6d28bce40))
* **compose:** tune the stack for the latency of one job, not six ([3f5e9d3](https://github.com/cheminfo/elucidation.cheminfo.org/commit/3f5e9d38ff744895875aa498b014fd73a2178c6f))
