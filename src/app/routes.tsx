import { createBrowserRouter } from "react-router";
import { Layout } from "./layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { AddTreeData } from "./pages/AddTreeData";
import { TreeList } from "./pages/TreeList";
import { WateringCalendar } from "./pages/WateringCalendar";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "add", Component: AddTreeData },
      { path: "list", Component: TreeList },
      { path: "calendar", Component: WateringCalendar },
      { path: "*", Component: () => <div className="p-8 text-center text-gray-500">Page Not Found</div> },
    ],
  },
]);