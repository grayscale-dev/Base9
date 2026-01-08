import ApiDocs from './pages/ApiDocs';
import Changelog from './pages/Changelog';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import Roadmap from './pages/Roadmap';
import Support from './pages/Support';
import WorkspaceSettings from './pages/WorkspaceSettings';
import JoinWorkspace from './pages/JoinWorkspace';
import Workspaces from './pages/Workspaces';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ApiDocs": ApiDocs,
    "Changelog": Changelog,
    "Feedback": Feedback,
    "Home": Home,
    "Roadmap": Roadmap,
    "Support": Support,
    "WorkspaceSettings": WorkspaceSettings,
    "JoinWorkspace": JoinWorkspace,
    "Workspaces": Workspaces,
}

export const pagesConfig = {
    mainPage: "ApiDocs",
    Pages: PAGES,
    Layout: __Layout,
};