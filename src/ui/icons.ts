export function iconClass(name: string): string {
  return `ph-bold ph-${name}`;
}

export function icon(name: string): string {
  return `<i class="${iconClass(name)}" aria-hidden="true"></i>`;
}
