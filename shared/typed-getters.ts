export const getById = <T extends HTMLElement>(id: string) => 
  document.getElementById(id) as T;