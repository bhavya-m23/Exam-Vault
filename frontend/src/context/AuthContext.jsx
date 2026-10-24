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
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  };

  const clearToast = () => {
    setToast(null);
  };

  // Set up global fetch interceptor to handle credentials, CSRF header, and 401 session expiration
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      let [resource, config = {}] = args;
      const headers = {
        'X-Requested-With': 'XMLHttpRequest',
        ...(config.headers || {})
      };

      const updatedConfig = {
        ...config,
        credentials: config.credentials || 'include',
        headers
      };

      const response = await originalFetch(resource, updatedConfig);

      // Mid-session expiration handler (ignore login endpoint which returns 401 for invalid credentials)
      if (response.status === 401) {
        const urlStr = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
        if (urlStr && !urlStr.includes('/api/auth/login')) {
          setCurrentUser((prev) => {
            if (prev !== null) {
              showToast('Your session has expired or been invalidated. Please sign in again.', 'danger');
            }
            return null;
          });
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Verify active server session on initial load
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setCurrentUser(data.user);
          }
        } else {
          if (isMounted) {
            setCurrentUser(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok && data.user) {
        setCurrentUser(data.user);
        showToast(data.message || `Welcome back, ${data.user.name} (${data.user.role})`, 'success');
        return true;
      } else {
        showToast(data.message || 'Invalid email or password.', 'danger');
        return false;
      }
    } catch (err) {
      showToast('Authentication service connection failure.', 'danger');
      return false;
    }
  };

  const switchUser = async (userId) => {
    try {
      const res = await fetch('/api/auth/switch-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });

      const data = await res.json();

      if (res.ok && data.user) {
        setCurrentUser(data.user);
        showToast(data.message || `Switched active context to: ${data.user.name} (${data.user.role})`, 'info');
        return true;
      } else {
        showToast(data.message || 'Failed to switch demo persona.', 'danger');
        return false;
      }
    } catch (err) {
      showToast('Error switching demo persona.', 'danger');
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      setCurrentUser(null);
      showToast('Signed out of ExamVault', 'info');
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      loading,
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
