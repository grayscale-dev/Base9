import ApiDocs from './pages/ApiDocs';
import Changelog from './pages/Changelog';
import Feedback from './pages/Feedback';
import Home from './pages/Home';
import JoinWorkspace from './pages/JoinWorkspace';
import Roadmap from './pages/Roadmap';
import Support from './pages/Support';
import WorkspaceSettings from './pages/WorkspaceSettings';
import Workspaces from './pages/Workspaces';
import Docs from './pages/Docs';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ApiDocs": ApiDocs,
    "Changelog": Changelog,
    "Feedback": Feedback,
    "Home": Home,
    "JoinWorkspace": JoinWorkspace,
    "Roadmap": Roadmap,
    "Support": Support,
    "WorkspaceSettings": WorkspaceSettings,
    "Workspaces": Workspaces,
    "Docs": Docs,
}

export const pagesConfig = {
    mainPage: "ApiDocs",
    Pages: PAGES,
    Layout: __Layout,
};