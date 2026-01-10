import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Save, X, Search, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import './Verification.css';

interface Facility {
  facility_id: string;
  name: string;
  short_name: string;
  state: string;
  setting: 'SNF' | 'ALF' | 'ILF';
  licensed_beds: number | null;
  operational_beds: number | null;
  parent_opco: string | null;
}

interface EditableFacility extends Facility {
  isNew?: boolean;
}

const STATES = ['ID', 'OR', 'WA', 'MT', 'CA', 'AZ', 'NV', 'UT', 'CO', 'WY'];
const SETTINGS: ('SNF' | 'ALF' | 'ILF')[] = ['SNF', 'ALF', 'ILF'];

async function fetchFacilities(): Promise<Facility[]> {
  const res = await fetch('http://localhost:3002/api/facilities');
  if (!res.ok) throw new Error('Failed to fetch facilities');
  return res.json();
}

async function createFacility(facility: Omit<Facility, 'facility_id'>): Promise<Facility> {
  const res = await fetch('http://localhost:3002/api/facilities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(facility),
  });
  if (!res.ok) throw new Error('Failed to create facility');
  return res.json();
}

async function updateFacility(facility: Facility): Promise<Facility> {
  const res = await fetch(`http://localhost:3002/api/facilities/${facility.facility_id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(facility),
  });
  if (!res.ok) throw new Error('Failed to update facility');
  return res.json();
}

async function deleteFacility(facilityId: string): Promise<void> {
  const res = await fetch(`http://localhost:3002/api/facilities/${facilityId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete facility');
}

async function updateFacilitySetting(facilityId: string, setting: string): Promise<Facility> {
  const res = await fetch(`http://localhost:3002/api/facilities/${facilityId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setting }),
  });
  if (!res.ok) throw new Error('Failed to update facility type');
  return res.json();
}

export function Verification() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditableFacility | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: facilities = [], isLoading, refetch } = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
  });

  const createMutation = useMutation({
    mutationFn: createFacility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setShowAddForm(false);
      setEditForm(null);
      showNotification('success', 'Facility created successfully');
    },
    onError: () => showNotification('error', 'Failed to create facility'),
  });

  const updateMutation = useMutation({
    mutationFn: updateFacility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setEditingId(null);
      setEditForm(null);
      showNotification('success', 'Facility updated successfully');
    },
    onError: () => showNotification('error', 'Failed to update facility'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFacility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      showNotification('success', 'Facility deleted successfully');
    },
    onError: () => showNotification('error', 'Failed to delete facility'),
  });

  const settingMutation = useMutation({
    mutationFn: ({ facilityId, setting }: { facilityId: string; setting: string }) =>
      updateFacilitySetting(facilityId, setting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      showNotification('success', 'Facility type updated');
    },
    onError: () => showNotification('error', 'Failed to update facility type'),
  });

  const handleSettingChange = (facilityId: string, newSetting: string) => {
    settingMutation.mutate({ facilityId, setting: newSetting });
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredFacilities = facilities.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.facility_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (facility: Facility) => {
    setEditingId(facility.facility_id);
    setEditForm({ ...facility });
    setShowAddForm(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      updateMutation.mutate(editForm);
    }
  };

  const handleDelete = (facilityId: string, facilityName: string) => {
    if (window.confirm(`Are you sure you want to delete "${facilityName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(facilityId);
    }
  };

  const handleAddNew = () => {
    setShowAddForm(true);
    setEditingId(null);
    setEditForm({
      facility_id: `FAC-${Date.now()}`,
      name: '',
      short_name: '',
      state: 'ID',
      setting: 'SNF',
      licensed_beds: null,
      operational_beds: null,
      parent_opco: null,
      isNew: true,
    });
  };

  const handleSaveNew = () => {
    if (editForm && editForm.name) {
      const { isNew, ...facilityData } = editForm;
      createMutation.mutate(facilityData);
    }
  };

  const handleCancelNew = () => {
    setShowAddForm(false);
    setEditForm(null);
  };

  const updateEditForm = (field: keyof EditableFacility, value: string | number | null) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  return (
    <div className="verification animate-fade-in">
      <div className="verification-header">
        <div>
          <h2>Data Verification</h2>
          <p className="text-muted">Manage and verify facility information</p>
        </div>
        <div className="verification-actions">
          <button className="btn btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={18} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={handleAddNew}>
            <Plus size={18} />
            Add Facility
          </button>
        </div>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {notification.message}
        </div>
      )}

      <div className="verification-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, ID, or state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="facility-count">
          {filteredFacilities.length} of {facilities.length} facilities
        </div>
      </div>

      {showAddForm && editForm && (
        <div className="add-form-card">
          <h3>Add New Facility</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Facility ID</label>
              <input
                type="text"
                value={editForm.facility_id}
                onChange={(e) => updateEditForm('facility_id', e.target.value)}
                placeholder="e.g., BOISE-001"
              />
            </div>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => updateEditForm('name', e.target.value)}
                placeholder="Full facility name"
              />
            </div>
            <div className="form-group">
              <label>Short Name</label>
              <input
                type="text"
                value={editForm.short_name}
                onChange={(e) => updateEditForm('short_name', e.target.value)}
                placeholder="Abbreviated name"
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <select
                value={editForm.state}
                onChange={(e) => updateEditForm('state', e.target.value)}
              >
                {STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Setting</label>
              <select
                value={editForm.setting}
                onChange={(e) => updateEditForm('setting', e.target.value as 'SNF' | 'ALF' | 'ILF')}
              >
                {SETTINGS.map((setting) => (
                  <option key={setting} value={setting}>{setting}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Licensed Beds</label>
              <input
                type="number"
                value={editForm.licensed_beds ?? ''}
                onChange={(e) => updateEditForm('licensed_beds', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Number of beds"
              />
            </div>
            <div className="form-group">
              <label>Operational Beds</label>
              <input
                type="number"
                value={editForm.operational_beds ?? ''}
                onChange={(e) => updateEditForm('operational_beds', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Number of beds"
              />
            </div>
            <div className="form-group">
              <label>Parent OpCo</label>
              <input
                type="text"
                value={editForm.parent_opco ?? ''}
                onChange={(e) => updateEditForm('parent_opco', e.target.value || null)}
                placeholder="Operating company"
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={handleCancelNew}>
              <X size={16} />
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveNew}
              disabled={!editForm.name || createMutation.isPending}
            >
              <Save size={16} />
              {createMutation.isPending ? 'Saving...' : 'Save Facility'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="facilities-table-container">
          <table className="facilities-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Short Name</th>
                <th>State</th>
                <th>Setting</th>
                <th>Licensed Beds</th>
                <th>Operational Beds</th>
                <th>Parent OpCo</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((facility) => (
                <tr key={facility.facility_id}>
                  {editingId === facility.facility_id && editForm ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editForm.facility_id}
                          onChange={(e) => updateEditForm('facility_id', e.target.value)}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => updateEditForm('name', e.target.value)}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.short_name}
                          onChange={(e) => updateEditForm('short_name', e.target.value)}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <select
                          value={editForm.state}
                          onChange={(e) => updateEditForm('state', e.target.value)}
                          className="table-select"
                        >
                          {STATES.map((state) => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={editForm.setting}
                          onChange={(e) => updateEditForm('setting', e.target.value as 'SNF' | 'ALF' | 'ILF')}
                          className="table-select"
                        >
                          {SETTINGS.map((setting) => (
                            <option key={setting} value={setting}>{setting}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editForm.licensed_beds ?? ''}
                          onChange={(e) => updateEditForm('licensed_beds', e.target.value ? parseInt(e.target.value) : null)}
                          className="table-input table-input-number"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editForm.operational_beds ?? ''}
                          onChange={(e) => updateEditForm('operational_beds', e.target.value ? parseInt(e.target.value) : null)}
                          className="table-input table-input-number"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.parent_opco ?? ''}
                          onChange={(e) => updateEditForm('parent_opco', e.target.value || null)}
                          className="table-input"
                        />
                      </td>
                      <td className="actions-cell">
                        <button
                          className="action-btn save"
                          onClick={handleSaveEdit}
                          disabled={updateMutation.isPending}
                          title="Save changes"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          className="action-btn cancel"
                          onClick={handleCancelEdit}
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="facility-id">{facility.facility_id}</td>
                      <td className="facility-name">{facility.name}</td>
                      <td>{facility.short_name}</td>
                      <td>{facility.state}</td>
                      <td>
                        <select
                          value={facility.setting}
                          onChange={(e) => handleSettingChange(facility.facility_id, e.target.value)}
                          className={`inline-type-select type-${facility.setting.toLowerCase()}`}
                          disabled={settingMutation.isPending}
                        >
                          {SETTINGS.map((setting) => (
                            <option key={setting} value={setting}>{setting}</option>
                          ))}
                        </select>
                      </td>
                      <td>{facility.licensed_beds ?? '--'}</td>
                      <td>{facility.operational_beds ?? '--'}</td>
                      <td>{facility.parent_opco ?? '--'}</td>
                      <td className="actions-cell">
                        <button
                          className="action-btn edit"
                          onClick={() => handleEdit(facility)}
                          title="Edit facility"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDelete(facility.facility_id, facility.name)}
                          disabled={deleteMutation.isPending}
                          title="Delete facility"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredFacilities.length === 0 && (
            <div className="empty-state">
              {searchTerm ? 'No facilities match your search' : 'No facilities found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
