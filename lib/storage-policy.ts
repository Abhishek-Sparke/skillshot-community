export function managedStoragePath(pathname: string) {
  return /^(shots|avatars|staging)\/[a-zA-Z0-9_./-]+$/.test(pathname)
    && pathname.split('/').every(part => part !== '..' && part !== '.' && part !== '');
}
