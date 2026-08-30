# Pin authentication and authorization dependencies

Better Auth, its Convex integration, convex-authz, and Convex are installed at exact, mutually verified versions with a committed lockfile. Updates to this dependency group happen together in dedicated pull requests and must pass authentication, role-matrix, and cross-tenant isolation tests before merging, preventing an unrelated dependency refresh from silently selecting an incompatible auth release.
