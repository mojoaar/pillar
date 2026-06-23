export interface PluginField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'checkbox';
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  category: 'Infrastructure' | 'Network' | 'Automation';
  icon: string; // Emoji representing the plugin
  configFields: PluginField[];
}

export const AVAILABLE_PLUGINS: PluginDefinition[] = [
  {
    id: 'proxmox-ve',
    name: 'Proxmox VE',
    description: 'Monitor hypervisor cluster health, read real-time node/VM statuses, send runtime power actions, and manage your virtual infrastructure.',
    category: 'Infrastructure',
    icon: '☁️',
    configFields: [
      { 
        key: 'apiUrl', 
        label: 'Proxmox API URL', 
        type: 'text', 
        required: true, 
        placeholder: 'e.g. https://192.168.1.100:8006/api2/json' 
      },
      { 
        key: 'apiToken', 
        label: 'API Token ID & Secret', 
        type: 'password', 
        required: true, 
        placeholder: 'e.g. root@pve!token-name=uuid-secret-string' 
      },
      { 
        key: 'verifySsl', 
        label: 'Verify SSL Certificate', 
        type: 'checkbox', 
        required: false, 
        defaultValue: 'false' 
      }
    ]
  },
  {
    id: 'systems',
    name: 'Remote Systems',
    description: 'Monitor remote server operating systems, uptime, and pending updates across your environment. Run system updates and reboots from a central dashboard.',
    category: 'Infrastructure',
    icon: '🖥️',
    configFields: []
  }
];
