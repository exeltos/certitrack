import { loadAllUsers } from './dashboard.js';
  document.addEventListener('DOMContentLoaded', () => {
    lucide?.createIcons();
    loadAllUsers();

    const bulkActions = document.getElementById('adminBulkActions');
    const updateBulkVisibility = () => {
      const selected = document.querySelectorAll('.admin-checkbox:checked');
      bulkActions?.classList.toggle('hidden', selected.length === 0);
    };

    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('admin-checkbox') || e.target.id === 'selectAllAdmin') {
        updateBulkVisibility();
      }
    });
  });
