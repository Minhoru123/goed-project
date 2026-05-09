import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AddCompany from './pages/AddCompany';
import CompanyProfile from './pages/CompanyProfile';
import Home from './pages/Home';
import Navigator from './pages/Navigator';
import StartupMap from './pages/StartupMap';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/navigator" element={<Navigator />} />
        <Route path="/map" element={<StartupMap />} />
        <Route path="/companies/:id" element={<CompanyProfile />} />
        <Route path="/add-company" element={<AddCompany />} />
      </Route>
    </Routes>
  );
}
