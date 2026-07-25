import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Church, Users, FileText, BookOpen, Heart, Cross } from 'lucide-react';

const MainDashboard = () => {
  const { user } = useAuth();
  const { data } = useAppData();

  const baptismStats = {
    total: data.baptisms.length,
    pending: data.baptisms.filter(b => b.status === 'pending').length,
    seated: data.baptisms.filter(b => b.status === 'seated').length,
    thisMonth: data.baptisms.filter(b => {
      const baptismDate = new Date(b.baptismDate);
      const now = new Date();
      return baptismDate.getMonth() === now.getMonth() && 
             baptismDate.getFullYear() === now.getFullYear();
    }).length
  };

  const dioceseModules = [
    {
      icon: Church,
      title: 'Baptisms',
      description: 'Manage baptism records',
      count: baptismStats.total,
      link: '/baptism/list',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Users,
      title: 'Parish Users',
      description: 'Create and manage parishes',
      count: data.users.filter(u => u.role === 'parish').length,
      link: '/create-parish',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: FileText,
      title: 'Import Data',
      description: 'Import JSON data files',
      link: '/import',
      color: 'from-green-500 to-green-600'
    }
  ];

  const parishModules = [
    {
      icon: Church,
      title: 'New Baptism',
      description: 'Register new baptism (pending)',
      count: baptismStats.pending,
      link: '/baptism/new',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: BookOpen,
      title: 'Already Celebrated',
      description: 'Register celebrated baptism',
      count: baptismStats.seated,
      link: '/baptism/celebrated',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: Users,
      title: 'Baptism Records',
      description: 'View all baptism records',
      count: baptismStats.total,
      link: '/baptism/list',
      color: 'from-green-500 to-green-600'
    },
    {
      icon: FileText,
      title: 'This Month',
      description: 'Baptisms this month',
      count: baptismStats.thisMonth,
      link: '/baptism/list',
      color: 'from-orange-500 to-orange-600'
    }
  ];

  const modules = user?.role === 'diocese' ? dioceseModules : parishModules;

  return (
    <>
      <Helmet>
        <title>{'Dashboard'}</title>
        <meta name="description" content="Main dashboard for baptism registry management" />
      </Helmet>

      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user?.role === 'diocese' ? user.dioceseName : user?.parishName}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules.map((module, index) => {
                const Icon = module.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Link to={module.link}>
                      <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                        <div className={`w-12 h-12 bg-gradient-to-r ${module.color} rounded-lg flex items-center justify-center mb-4`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {module.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {module.description}
                        </p>
                        {module.count !== undefined && (
                          <div className="text-2xl font-bold text-gray-900">
                            {module.count}
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </>
  );
};

export default MainDashboard;