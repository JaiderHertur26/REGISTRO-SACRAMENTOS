import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, User, Database, Lock } from 'lucide-react';

const DebugAuthPage = () => {
    const auth = useAuth();
    const appData = useAppData();
    const navigate = useNavigate();

    const { user } = auth;

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Diagnostics</h1>
                            <p className="text-gray-500">Authentication & Context State Inspector</p>
                        </div>
                    </div>
                    <div className="bg-blue-100 text-blue-800 text-xs font-mono py-1 px-3 rounded-full border border-blue-200">
                        /debug-auth
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* User Identity Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-600" />
                            <h2 className="font-semibold text-gray-800">User Identity</h2>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">Username</span>
                                <span className="font-medium text-gray-900">{user?.username || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">Email</span>
                                <span className="font-medium text-gray-900">{user?.email || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">ID</span>
                                <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{user?.id || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-gray-500 text-sm">Created At</span>
                                <span className="text-xs text-gray-700">{user?.createdAt || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Role Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-purple-600" />
                            <h2 className="font-semibold text-gray-800">Role & Access</h2>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">Current Role</span>
                                <span className="font-bold text-white bg-purple-600 px-3 py-1 rounded-full text-xs uppercase tracking-wider">
                                    {user?.role || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">Auth Status</span>
                                <span className={`font-bold px-2 py-1 rounded text-xs ${auth.isAuthenticated() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {auth.isAuthenticated() ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}
                                </span>
                            </div>
                             <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">Parish Context</span>
                                <span className="font-medium text-gray-900 text-right">{user?.parishName || 'None'}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-gray-500 text-sm">Diocese Context</span>
                                <span className="font-medium text-gray-900 text-right">{user?.dioceseName || 'None'}</span>
                            </div>
                        </div>
                    </div>

                     {/* System Status Section */}
                     <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                            <Database className="w-5 h-5 text-green-600" />
                            <h2 className="font-semibold text-gray-800">Data Context</h2>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">Users in Store</span>
                                <span className="font-mono font-bold text-gray-900">{appData.data?.users?.length || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">Parishes in Store</span>
                                <span className="font-mono font-bold text-gray-900">{appData.data?.parishes?.length || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500 text-sm">Sacraments Loaded</span>
                                <span className="font-mono font-bold text-gray-900">{appData.data?.sacraments?.length || 0}</span>
                            </div>
                             <div className="flex justify-between pt-1">
                                <span className="text-gray-500 text-sm">Auth Loading State</span>
                                <span className="font-mono text-gray-900">{auth.loading ? 'True' : 'False'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Raw JSON Dumps */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="flex flex-col h-[500px]">
                         <div className="bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg flex items-center gap-2 border-b border-gray-700">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm font-mono font-bold">AuthContext.user (Raw JSON)</span>
                        </div>
                        <div className="bg-gray-900 text-green-400 p-4 rounded-b-lg shadow-lg overflow-auto flex-1 border border-gray-800">
                            <pre className="text-xs font-mono leading-relaxed">
                                {JSON.stringify(user, null, 2)}
                            </pre>
                        </div>
                    </div>

                    <div className="flex flex-col h-[500px]">
                        <div className="bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg flex items-center gap-2 border-b border-gray-700">
                            <Database className="w-4 h-4" />
                            <span className="text-sm font-mono font-bold">AppDataContext.data (Structure & Counts)</span>
                        </div>
                        <div className="bg-gray-900 text-blue-400 p-4 rounded-b-lg shadow-lg overflow-auto flex-1 border border-gray-800">
                             <pre className="text-xs font-mono leading-relaxed">
                                {JSON.stringify({
                                    usersCount: appData.data?.users?.length,
                                    parishesCount: appData.data?.parishes?.length,
                                    diocesesCount: appData.data?.dioceses?.length,
                                    sampleUser: appData.data?.users?.[0] || 'No users',
                                    currentUserFromAppData: appData.user,
                                    localStorageKeys: Object.keys(localStorage)
                                }, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugAuthPage;