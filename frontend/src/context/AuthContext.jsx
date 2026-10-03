import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const initialUsers = [
  {
    id: "USR-001",
    name: "System Admin",
    email: "admin@examvault.local",
    role: "Administrator",
    department: "Cyber Security & IT"
  },
  {
    id: "USR-002",
    name: "Dr. Priya Sharma",
    email: "priya.sharma@university.edu",
    role: "Exam Coordinator",
    department: "Computer Science"
  },
  {
    id: "USR-003",
    name: "Akash G",
    email: "akash.g@university.edu",
    role: "Staff",
    department: "Academic Office"
  },
  {
    id: "USR-004",
    name: "Prof. Rahul Kumar",
    email: "rahul.kumar@university.edu",
    role: "Course Instructor",
    department: "Computer Science"
  },
  {
    id: "USR-005",
    name: "Dr. Anitha Rao",
    email: "anitha.rao@university.edu",
    role: "Exam Evaluator",
    department: "Information Technology"
  }
];

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('examvault_user');
    return saved ? JSON.parse(saved) : initialUsers[1]; // Default to Dr. Priya Sharma (Exam Coordinator)
  });

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  };

  const clearToast = () => {
    setToast(null);
  };

  const login = (email, password) => {
    const user = initialUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user || (email === 'admin@examvault.local' && password === 'admin123')) {
      const active = user || initialUsers[0];
      setCurrentUser(active);
      localStorage.setItem('examvault_user', JSON.stringify(active));
      showToast(`Welcome back, ${active.name} (${active.role})`, 'success');
      return true;
    }
    showToast('Invalid credentials. Use demo account admin@examvault.local / admin123', 'danger');
    return false;
  };

  const switchUser = (userId) => {
    const user = initialUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('examvault_user', JSON.stringify(user));
      showToast(`Switched active context to: ${user.name} (${user.role})`, 'info');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('examvault_user');
    showToast('Signed out of ExamVault', 'info');
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      users: initialUsers,
      login,
      switchUser,
      logout,
      toast,
      showToast,
      clearToast
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
