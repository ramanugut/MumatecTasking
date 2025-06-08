// Role Builder module for managing custom roles and permissions

export const FEATURES = ['projects', 'tasks', 'users', 'reports', 'settings', 'billing', 'clientData'];
export const ACTIONS = ['create', 'read', 'update', 'delete'];

function loadRoles() {
  try {
    return JSON.parse(localStorage.getItem('customRoles') || '[]');
  } catch (_) {
    return [];
  }
}

function saveRoles(roles) {
  localStorage.setItem('customRoles', JSON.stringify(roles));
}

export class RoleBuilder {
  constructor() {
    this.roles = loadRoles();
  }

  getRole(name) {
    return this.roles.find(r => r.name === name) || null;
  }

  createRole(name) {
    if (this.getRole(name)) return false;
    const role = {
      name,
      permissions: {}, // { resource: { action: boolean } }
      features: {},    // { feature: boolean }
      access: { projects: [], clients: [] } // resource level ids
    };
    FEATURES.forEach(res => {
      role.permissions[res] = {};
      ACTIONS.forEach(a => { role.permissions[res][a] = false; });
      role.features[res] = false;
    });
    this.roles.push(role);
    saveRoles(this.roles);
    return true;
  }

  setPermission(roleName, resource, action, allowed) {
    const role = this.getRole(roleName);
    if (!role || !FEATURES.includes(resource) || !ACTIONS.includes(action)) return;
    role.permissions[resource][action] = !!allowed;
    saveRoles(this.roles);
  }

  toggleFeature(roleName, feature, enabled) {
    const role = this.getRole(roleName);
    if (!role || !FEATURES.includes(feature)) return;
    role.features[feature] = !!enabled;
    saveRoles(this.roles);
  }

  setResourceAccess(roleName, type, ids) {
    const role = this.getRole(roleName);
    if (!role || !['projects','clients'].includes(type)) return;
    role.access[type] = Array.isArray(ids) ? ids : [];
    saveRoles(this.roles);
  }

  hasPermission(roleName, resource, action) {
    const role = this.getRole(roleName);
    if (!role) return false;
    return !!(role.permissions[resource] && role.permissions[resource][action]);
  }

  featureEnabled(roleName, feature) {
    const role = this.getRole(roleName);
    if (!role) return false;
    return !!role.features[feature];
  }

  getAccess(roleName, type) {
    const role = this.getRole(roleName);
    if (!role) return [];
    return role.access[type] || [];
  }

  getAllRoles() {
    return [...this.roles];
  }
}
