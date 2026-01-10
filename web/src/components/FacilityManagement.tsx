import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Save, Building2, Loader2 } from 'lucide-react';
import './FacilityManagement.css';

interface Facility {
  facility_id: string;
  name: string;
  short_name: string;
  state: string;
  setting: string;
  licensed_beds: number | null;
  operational_beds: number | null;
  parent_opco: string | null;
}

const API_BASE = 'https://snfpnl.onrender.com';

const STATES = ['AZ', 'ID', 'MT', 'OR', 'WA'];
const SETTINGS = ['SNF', 'ALF', 'ILF'];

async function fetchFacilities(): Promise<Facility[]> {
  const res = await fetch(`${API_BASE}/api/facilities`);
  if (!res.ok) throw new Error('Failed to fetch facilities');
  return res.json();
}

async function createFacility(facility: Partial<Facility>): Promise<Facility> {
  const res = await fetch(`${API_BASE}/api/facilities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(facility),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create facility');
  }
  return res.json();
}

async function updateFacility(id: string, facility: Partial<Facility>): Promise<Facility> {
  const res = await fetch(`${API_BASE}/api/facilities/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(facility),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update facility');
  }
  return res.json();
}

async function deleteFacility(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/facilities/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete facility');
  }
}

interface FacilityFormData {
  facility_id: string;
  name: string;
  short_name: string;
  state: string;
  setting: string;
  licensed_beds: string;
  operational_beds: string;
  parent_opco: string;
}

const emptyForm: FacilityFormData = {
  facility_id: '',
  name: '',
  short_name: '',
  state: 'ID',
  setting: 'SNF',
  licensed_beds: '',
  operational_beds: '',
  parent_opco: '',
};

export function FacilityManagement() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [formData, setFormData] = useState<FacilityFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterSetting, setFilterSetting] = useState<string>('all');

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
  });

  const createMutation = useMutation({
    mutationFn: createFacility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Facility> }) => updateFacility(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFacility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setDeleteConfirm(null);
    },
  });

  const openAddModal = () => {
    setEditingFacility(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (facility: Facility) => {
    setEditingFacility(facility);
    setFormData({
      facility_id: facility.facility_id,
      name: facility.name,
      short_name: facility.short_name || '',
      state: facility.state,
      setting: facility.setting,
      licensed_beds: facility.licensed_beds?.toString() || '',
      operational_beds: facility.operational_beds?.toString() || '',
      parent_opco: facility.parent_opco || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFacility(null);
    setFormData(emptyForm);
    createMutation.reset();
    updateMutation.reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const facilityData: Partial<Facility> = {
      facility_id: formData.facility_id,
      name: formData.name,
      short_name: formData.short_name,
      state: formData.state,
      setting: formData.setting,
      licensed_beds: formData.licensed_beds ? parseInt(formData.licensed_beds) : null,
      operational_beds: formData.operational_beds ? parseInt(formData.operational_beds) : null,
      parent_opco: formData.parent_opco || null,
    };

    if (editingFacility) {
      updateMutation.mutate({ id: editingFacility.facility_id, data: facilityData });
    } else {
      createMutation.mutate(facilityData);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const filteredFacilities = facilities.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          f.facility_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = filterState === 'all' || f.state === filterState;
    const matchesSetting = filterSetting === 'all' || f.setting === filterSetting;
    return matchesSearch && matchesState && matchesSetting;
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const submitError = createMutation.error || updateMutation.error;

  return (
    <div className="facility-management">
      <div className="fm-header">
        <div className="fm-title">
          <Building2 size={28} />
          <div>
            <h1>Facility Management</h1>
            <p>{facilities.length} facilities in portfolio</p>
          </div>
        </div>
        <button className="btn-add" onClick={openAddModal}>
          <Plus size={18} />
          Add Facility
        </button>
      </div>

      <div className="fm-filters">
        <input
          type="text"
          placeholder="Search facilities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="fm-search"
        />
        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="fm-select">
          <option value="all">All States</option>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterSetting} onChange={(e) => setFilterSetting(e.target.value)} className="fm-select">
          <option value="all">All Settings</option>
          {SETTINGS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="fm-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading facilities...</p>
        </div>
      ) : (
        <div className="fm-table-wrapper">
          <table className="fm-table">
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
              {filteredFacilities.map(facility => (
                <tr key={facility.facility_id}>
                  <td className="id-cell">{facility.facility_id}</td>
                  <td className="name-cell">{facility.name}</td>
                  <td>{facility.short_name || '-'}</td>
                  <td><span className="state-badge">{facility.state}</span></td>
                  <td><span className={`setting-badge ${facility.setting.toLowerCase()}`}>{facility.setting}</span></td>
                  <td>{facility.licensed_beds ?? '-'}</td>
                  <td>{facility.operational_beds ?? '-'}</td>
                  <td>{facility.parent_opco || '-'}</td>
                  <td className="actions-cell">
                    <button className="btn-icon edit" onClick={() => openEditModal(facility)} title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button className="btn-icon delete" onClick={() => setDeleteConfirm(facility.facility_id)} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFacilities.length === 0 && (
            <div className="fm-empty">No facilities found matching your criteria</div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingFacility ? 'Edit Facility' : 'Add New Facility'}</h2>
              <button className="btn-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Facility ID *</label>
                  <input
                    type="text"
                    value={formData.facility_id}
                    onChange={(e) => setFormData({ ...formData, facility_id: e.target.value })}
                    required
                    disabled={!!editingFacility}
                    placeholder="e.g., 503"
                  />
                </div>
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Mountain View Care Center"
                  />
                </div>
                <div className="form-group">
                  <label>Short Name</label>
                  <input
                    type="text"
                    value={formData.short_name}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                    placeholder="e.g., MVCC"
                  />
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                  >
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Setting *</label>
                  <select
                    value={formData.setting}
                    onChange={(e) => setFormData({ ...formData, setting: e.target.value })}
                    required
                  >
                    {SETTINGS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Licensed Beds</label>
                  <input
                    type="number"
                    value={formData.licensed_beds}
                    onChange={(e) => setFormData({ ...formData, licensed_beds: e.target.value })}
                    placeholder="e.g., 120"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Operational Beds</label>
                  <input
                    type="number"
                    value={formData.operational_beds}
                    onChange={(e) => setFormData({ ...formData, operational_beds: e.target.value })}
                    placeholder="e.g., 100"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Parent OpCo</label>
                  <input
                    type="text"
                    value={formData.parent_opco}
                    onChange={(e) => setFormData({ ...formData, parent_opco: e.target.value })}
                    placeholder="e.g., Cascadia Healthcare"
                  />
                </div>
              </div>
              {submitError && (
                <div className="form-error">
                  {submitError.message}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingFacility ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-icon">
              <Trash2 size={32} />
            </div>
            <h2>Delete Facility?</h2>
            <p>
              This will permanently delete <strong>{facilities.find(f => f.facility_id === deleteConfirm)?.name}</strong> and all associated data (KPIs, financial records, etc.).
            </p>
            <p className="warning">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn-delete"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </button>
            </div>
            {deleteMutation.error && (
              <div className="form-error">
                {deleteMutation.error.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
