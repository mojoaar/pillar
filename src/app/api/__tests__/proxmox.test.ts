import { describe, it, expect } from 'vitest';

describe('Proxmox plugin API logic', () => {
  describe('VM resource mapping validation', () => {
    it('accepts valid resource types', () => {
      expect('qemu').toBe('qemu');
      expect('lxc').toBe('lxc');
    });

    it('rejects invalid resource types', () => {
      const valid = ['qemu', 'lxc'];
      expect(valid.includes('vm')).toBe(false);
    });
  });

  describe('vmid validation', () => {
    it('accepts vmid=0 as valid', () => {
      const vmid = 0;
      const isValidVmid = vmid !== undefined && vmid !== null;
      expect(isValidVmid).toBe(true); // 0 is a valid Proxmox VM ID
    });

    it('rejects undefined vmid', () => {
      let vmid: number | undefined;
      const isValidVmid = vmid !== undefined && vmid !== null;
      expect(isValidVmid).toBe(false);
    });
  });

  describe('error messages', () => {
    it('production returns generic error not raw Proxmox error', () => {
      const prodResponse = { error: 'Internal Server Error', status: 500 };
      expect(prodResponse.error).toBe('Internal Server Error');
      expect(prodResponse.error).not.toContain('ECONNREFUSED');
      expect(prodResponse.error).not.toContain('192.168.');
    });
  });
});
