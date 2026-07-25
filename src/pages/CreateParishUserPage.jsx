import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Save } from 'lucide-react';

const CreateParishUserPage = () => {
  const { user } = useAuth();
  const { data, addUser } = useAppData();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    parishName: '',
    vicariate: '',
    deanery: '',
    priestName: '',
    priestStartDate: '',
    nit: '',
    address: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    dioceseName: user?.dioceseName || '',
    bishopName: user?.bishopName || ''
  });

  const [filteredDeaneries, setFilteredDeaneries] = useState([]);

  useEffect(() => {
    if (formData.vicariate) {
      const selectedVicariate = data.vicariates.find(v => v.name === formData.vicariate);
      if (selectedVicariate) {
        const deaneriesForVicariate = data.deaneries.filter(
          d => d.vicariateId === selectedVicariate.id
        );
        setFilteredDeaneries(deaneriesForVicariate);
        if (!deaneriesForVicariate.find(d => d.name === formData.deanery)) {
          setFormData(prev => ({ ...prev, deanery: '' }));
        }
      }
    } else {
      setFilteredDeaneries([]);
      setFormData(prev => ({ ...prev, deanery: '' }));
    }
  }, [formData.vicariate, data.vicariates, data.deaneries]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newUser = {
      ...formData,
      role: 'parish'
    };

    addUser(newUser);

    toast({
      title: "Parish User Created",
      description: `Parish "${formData.parishName}" has been created successfully.`,
    });

    navigate('/dashboard');
  };

  return (
    <>
      <Helmet>
        <title>{'Create Parish User'}</title>
        <meta name="description" content="Create a new parish user account" />
      </Helmet>

      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Create Parish User</h1>
                <p className="text-gray-600 mt-1">Add a new parish to the diocese</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-6">
              {/* Parish Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Parish Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parish Name *
                    </label>
                    <input
                      type="text"
                      name="parishName"
                      value={formData.parishName}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vicariate *
                    </label>
                    <select
                      name="vicariate"
                      value={formData.vicariate}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    >
                      <option value="">Select Vicariate</option>
                      {data.vicariates.map(v => (
                        <option key={v.id} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deanery *
                    </label>
                    <select
                      name="deanery"
                      value={formData.deanery}
                      onChange={handleChange}
                      required
                      disabled={!formData.vicariate}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 disabled:bg-gray-100"
                    >
                      <option value="">Select Deanery</option>
                      {filteredDeaneries.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NIT
                    </label>
                    <input
                      type="text"
                      name="nit"
                      value={formData.nit}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Priest Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Priest Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priest Name *
                    </label>
                    <input
                      type="text"
                      name="priestName"
                      value={formData.priestName}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="priestStartDate"
                      value={formData.priestStartDate}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address *
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Login Credentials */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Login Credentials</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Auto-populated fields (read-only) */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Diocese Information (Auto-populated)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Diocese Name
                    </label>
                    <input
                      type="text"
                      value={formData.dioceseName}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bishop Name
                    </label>
                    <input
                      type="text"
                      value={formData.bishopName}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 gap-2"
                >
                  <Save className="w-4 h-4" />
                  Create Parish User
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </DashboardLayout>
    </>
  );
};

export default CreateParishUserPage;