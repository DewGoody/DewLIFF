import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CampaignList from './components/CampaignList';
import CampaignEditor from './components/CampaignEditor';
import MessageLibrary from './components/MessageLibrary';
import MessageManager from './components/MessageManager';
import ReplyDesigner from './components/ReplyDesigner';
import RichMenuManager from './components/RichMenuManager';
import RewardPools from './pages/RewardPools';
import AppearanceConsole from './pages/AppearanceConsole';

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/" element={<CampaignList />} />
        <Route path="/campaign/:id" element={<CampaignEditor />} />
        <Route path="/campaign/:id/appearance" element={<AppearanceConsole />} />
        <Route path="/campaign/:id/replies" element={<ReplyDesigner />} />
        <Route path="/messages" element={<MessageLibrary />} />
        <Route path="/message-manager" element={<MessageManager />} />
        <Route path="/rich-menu-manager" element={<RichMenuManager />} />
        <Route path="/rewards" element={<RewardPools />} />
      </Routes>
    </BrowserRouter>
  );
}
