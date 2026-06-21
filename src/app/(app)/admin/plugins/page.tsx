'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Sliders, ToggleLeft, ToggleRight, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  enabled: boolean;
  config: Record<string, string>;
  configFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'checkbox';
    required: boolean;
    placeholder?: string;
    defaultValue?: string;
  }>;
}

export default function AdminPluginsPage() {
  const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Configure Modal State
  const [editingPlugin, setEditingPlugin] = useState<PluginDefinition | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [pluginEnabled, setPluginEnabled] = useState(false);

  // Fetch plugins configuration on mount
  const fetchPlugins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/plugins');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch plugins.');
      setPlugins(data.data || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleOpenConfig = (plugin: PluginDefinition) => {
    setEditingPlugin(plugin);
    setPluginEnabled(plugin.enabled);
    
    // Set initial form states
    const initialForm: Record<string, string> = {};
    plugin.configFields.forEach((field) => {
      initialForm[field.key] = plugin.config[field.key] || field.defaultValue || '';
    });
    setFormData(initialForm);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlugin) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/plugins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPlugin.id,
          enabled: pluginEnabled,
          config: formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update plugin settings.');

      setSuccess(`${editingPlugin.name} configured successfully.`);
      setEditingPlugin(null);
      
      // Refresh list
      await fetchPlugins();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Block */}
      <div className="flex-between">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
          <Link href="/admin" className="btn btn-secondary btn-sm" title="Back to Admin Dashboard">
            <ArrowLeft size={14} />
            <span>Back to Panel</span>
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🔌</span>
            <span>System Integrations & Plugins</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Configure global external connectors, turn integrations on or off, and authorize users.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchPlugins} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(255, 85, 85, 0.1)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          backgroundColor: 'rgba(46, 204, 113, 0.1)',
          border: '1px solid var(--success)',
          color: 'var(--success)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Loading Grid Placeholder */}
      {loading && plugins.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      ) : (
        /* Plugins Catalog Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {plugins.map((plugin) => (
            <div key={plugin.id} className="card" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              borderColor: plugin.enabled ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.2s ease'
            }}>
              <div>
                <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{plugin.icon}</span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{plugin.name}</h3>
                  </div>
                  <span className="badge" style={{ fontSize: '0.65rem', backgroundColor: 'var(--bg-tertiary)' }}>
                    {plugin.category}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.25rem' }}>
                  {plugin.description}
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)',
                marginTop: 'auto'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600 }}>
                  {plugin.enabled ? (
                    <>
                      <ToggleRight size={24} style={{ color: 'var(--accent)', cursor: 'pointer' }} />
                      <span style={{ color: 'var(--accent)' }}>Active</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft size={24} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Inactive</span>
                    </>
                  )}
                </span>

                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenConfig(plugin)}>
                  <Sliders size={14} />
                  <span>Configure</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuration Modal */}
      {editingPlugin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1.5rem', color: 'var(--accent)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{editingPlugin.icon}</span>
              <span>Configure {editingPlugin.name}</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Populate server connectors. Sensitive configurations are encrypted securely at-rest.
            </p>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Enabled Switch */}
              <div className="form-group" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '0.9rem' }}>Enable Plugin</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Toggle availability globally in navigation bars</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPluginEnabled(!pluginEnabled)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  {pluginEnabled ? (
                    <ToggleRight size={32} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <ToggleLeft size={32} style={{ color: 'var(--text-muted)' }} />
                  )}
                </button>
              </div>

              {/* Dynamic Config Fields */}
              {editingPlugin.configFields.map((field) => (
                <div key={field.key} className="form-group">
                  <label htmlFor={`config-${field.key}`}>{field.label} {field.required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                  
                  {field.type === 'checkbox' ? (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.25rem' }}>
                      <input
                        type="checkbox"
                        id={`config-${field.key}`}
                        checked={formData[field.key] === 'true' || formData[field.key] === true as any}
                        onChange={(e) => handleFieldChange(field.key, e.target.checked ? 'true' : 'false')}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        disabled={saving}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                        Bypass strict cert chains (Ignore untrusted TLS validation)
                      </span>
                    </div>
                  ) : (
                    <input
                      type={field.type}
                      id={`config-${field.key}`}
                      className="input-field"
                      placeholder={field.placeholder || ''}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      required={field.required}
                      disabled={saving}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPlugin(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={16} />
                  <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Keyframes Styling */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
