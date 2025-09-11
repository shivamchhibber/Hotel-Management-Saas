import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "components/navbar";
import Sidebar from "components/sidebar";
import Footer from "components/footer/Footer";
import ProtectedRoute from "components/ProtectedRoute";
import SuperAdminRoutes from "routes/super-admin";

export default function SuperAdminLayout(props) {
    const { ...rest } = props;
    const location = useLocation();
    const [open, setOpen] = React.useState(true);
    const [currentRoute, setCurrentRoute] = React.useState("Dashboard");

    React.useEffect(() => {
        window.addEventListener("resize", () =>
            window.innerWidth < 1200 ? setOpen(false) : setOpen(true)
        );
    }, []);

    React.useEffect(() => {
        getActiveRoute(SuperAdminRoutes);
    }, [location.pathname]);

    const getActiveRoute = (routes) => {
        let activeRoute = "Dashboard";
        for (let i = 0; i < routes.length; i++) {
            if (
                window.location.href.indexOf(
                    routes[i].layout + "/" + routes[i].path
                ) !== -1
            ) {
                setCurrentRoute(routes[i].name);
            }
        }
        return activeRoute;
    };

    const getActiveNavbar = (routes) => {
        let activeNavbar = false;
        for (let i = 0; i < routes.length; i++) {
            if (
                window.location.href.indexOf(routes[i].layout + routes[i].path) !== -1
            ) {
                return routes[i].secondary;
            }
        }
        return activeNavbar;
    };

    const getRoutes = (routes) => {
        return routes.map((prop, key) => {
            if (prop.layout === "/super-admin") {
                return (
                    <Route path={`/${prop.path}`} element={prop.component} key={key} />
                );
            } else {
                return null;
            }
        });
    };

    document.documentElement.dir = "ltr";
    return (
        <ProtectedRoute requiredRole="super_admin">
            <div className="flex h-full w-full">
                <Sidebar open={open} onClose={() => setOpen(false)} routes={SuperAdminRoutes} />
                {/* Navbar & Main Content */}
                <div className="h-full w-full bg-lightPrimary dark:!bg-navy-900">
                    {/* Main Content */}
                    <main
                        className={`mx-[12px] h-full flex-none transition-all md:pr-2 xl:ml-[313px]`}
                    >
                        {/* Routes */}
                        <div className="h-full">
                            <Navbar
                                onOpenSidenav={() => setOpen(true)}
                                logoText={"Hotel Management"}
                                brandText={currentRoute}
                                secondary={getActiveNavbar(SuperAdminRoutes)}
                                {...rest}
                            />
                            <div className="pt-5s mx-auto mb-auto h-full min-h-[84vh] p-2 md:pr-2">
                                <Routes>
                                    {getRoutes(SuperAdminRoutes)}
                                    <Route
                                        path="/"
                                        element={<Navigate to="/super-admin/dashboard" replace />}
                                    />
                                </Routes>
                            </div>
                            <div className="p-3">
                                <Footer />
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}
