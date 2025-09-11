import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "components/navbar";
import Sidebar from "components/sidebar";
import Footer from "components/footer/Footer";
import ProtectedRoute from "components/ProtectedRoute";
import GuestRoutes from "routes/guest";

export default function GuestLayout(props) {
    const { ...rest } = props;
    const location = useLocation();
    const [open, setOpen] = React.useState(true);
    const [currentRoute, setCurrentRoute] = React.useState("My Stays");

    React.useEffect(() => {
        window.addEventListener("resize", () =>
            window.innerWidth < 1200 ? setOpen(false) : setOpen(true)
        );
    }, []);

    React.useEffect(() => {
        getActiveRoute(GuestRoutes);
    }, [location.pathname]);

    const getActiveRoute = (routes) => {
        let activeRoute = "My Stays";
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
            if (prop.layout === "/guest") {
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
        <ProtectedRoute requiredRole="guest">
            <div className="flex h-full w-full">
                <Sidebar open={open} onClose={() => setOpen(false)} routes={GuestRoutes} />
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
                                secondary={getActiveNavbar(GuestRoutes)}
                                {...rest}
                            />
                            <div className="pt-5s mx-auto mb-auto h-full min-h-[84vh] p-2 md:pr-2">
                                <Routes>
                                    {getRoutes(GuestRoutes)}
                                    <Route
                                        path="/"
                                        element={<Navigate to="/guest/my-stays" replace />}
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
