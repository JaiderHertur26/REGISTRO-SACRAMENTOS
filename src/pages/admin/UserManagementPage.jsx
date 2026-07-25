import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Table from '@/components/ui/Table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Key } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import CreateDioceseUserModal from '@/components/modals/CreateDioceseUserModal';
import EditDioceseUserModal from '@/components/modals/EditDioceseUserModal';
import ChangePasswordModal from '@/components/modals/ChangePasswordModal';

const UserManagementPage = ({ roleToManage, title }) => {
  const { data, deleteUser } = useAppData();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const users = data.users.filter(u => {
    if (u.role !== roleToManage) return false;
    if (currentUser.role === 'diocese') {
        return u.dioceseId === currentUser.dioceseId;
    }
    return true;
  });

  const handleDelete = (userId) => {
    if (window.confirm('¿Está seguro de eliminar este usuario?')) {
      deleteUser(userId);
      toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado correctamente.' });
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handlePasswordChange = (user) => {
    setSelectedUser(user);
    setIsPasswordModalOpen(true);
  };

  const safeString = (val) => {
      if (typeof val === 'string') return val;
      if (typeof val === 'object' && val !== null) return val.name || val.label || '';
      return String(val || '');
  };

  const columns = [
    { header: 'Usuario', accessor: 'username' },
    { header: 'Email', accessor: 'email' },
    { 
        header: 'Entidad', 
        render: (row) => {
            if (row.role === 'diocese') return safeString(row.dioceseName);
            if (row.role === 'parish') return safeString(row.parishName) || 'Parroquia';
            if (row.role === 'chancery') return 'Cancillería';
            return '-';
        }
    },
    {
      header: 'Acciones',
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(row)} title="Editar">
            <Edit className="w-4 h-4 text-blue-600" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handlePasswordChange(row)} title="Cambiar Contraseña">
             <Key className="w-4 h-4 text-orange-500" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)} title="Eliminar">
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      )
    }
  ];
  
  const handleCreateClick = () => {
    if (roleToManage === 'diocese') {
        setIsCreateModalOpen(true);
    } else {
        toast({ title: 'En desarrollo', description: 'La creación de este tipo de usuario estará disponible pronto.' });
    }
  };

  return (
    <DashboardLayout entityName={title}>
       <UserManagementContent 
          title={title} 
          users={users} 
          columns={columns} 
          onCreate={handleCreateClick}
          roleToManage={roleToManage}
       />

       <CreateDioceseUserModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => {}}
       />
       
       {selectedUser && (
        <>
            <EditDioceseUserModal 
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => setSelectedUser(null)}
                user={selectedUser}
            />
            <ChangePasswordModal 
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                user={selectedUser}
            />
        </>
       )}
    </DashboardLayout>
  );
};

const UserManagementContent = ({ title, users, columns, onCreate, roleToManage }) => {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-[#2C3E50]">{title}</h1>
                <Button onClick={onCreate} className="gap-2">
                    <Plus className="w-4 h-4" /> Crear Usuario
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <Table columns={columns} data={users} />
            </div>
        </div>
    );
};

const UserManagementPageWrapper = (props) => {
    return (
        <UserManagementPage {...props} />
    );
};

export default UserManagementPageWrapper;