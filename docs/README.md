# FreightOne - TPPB Management System

Modern web application for managing TPPB (Tempat Penimbunan Berikat) operations with Bridge, Pabean, and centralized management modules.

## 🚀 Features

### Bridge TPPB Module
- **Pendaftaran Management** - Quotation and registration management
- **Master Data** - BC Codes, Item Codes, Customer & Vendor management
- **Warehouse Operations** - Inventory, Inbound/Outbound management
- **Finance** - Invoice & payment tracking with auto-fill from quotations
- **Customs Documentation** - BC document tracking
- **Goods Movement** - Transaction history and mutation logs
- **Revenue Analytics** - Daily and monthly revenue charts

### Pabean (Customs) Portal
- **Dashboard** - Transaction monitoring & document status tracking
- **Barang Masuk** - Inbound transaction management (14-column detailed view)
- **Barang Keluar** - Outbound transaction management
- **Barang Reject/Scrap** - Damaged/rejected goods tracking
- **Pergerakan Barang** - Goods movement history

### Centralized Modules
- **Customer Management** - Client database
- **Vendor Management** - Supplier database
- **Finance** - Centralized financial tracking

### Big Module
- **Event Management** - Trade show and exhibition management

## 🛠️ Tech Stack

- **Frontend:** React 19 + Vite
- **Routing:** React Router DOM v7
- **Styling:** TailwindCSS
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Charts:** Recharts
- **State Management:** React Context API

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/FreightOne.git
cd FreightOne

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Deployment

### Vercel (Recommended)

1. **Push to GitHub:**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Vite configuration
   - Click "Deploy"

### Manual Deployment

```bash
# Build the project
npm run build

# The dist/ folder contains production build
# Upload dist/ contents to your hosting provider
```

## 📁 Project Structure

```
FreightOne/
├── src/
│   ├── components/
│   │   ├── Common/          # Reusable components
│   │   ├── Layout/          # Layout components
│   │   └── Warehouse/       # Warehouse-specific components
│   ├── pages/
│   │   ├── Bridge/          # Bridge TPPB module pages
│   │   ├── Pabean/          # Customs portal pages
│   │   ├── Centralized/     # Centralized module pages
│   │   └── Big/             # Event management pages
│   ├── context/
│   │   └── DataContext.jsx  # Global state management
│   ├── utils/               # Utility functions
│   ├── App.jsx             # Main app component
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── public/                  # Static assets
├── dist/                    # Production build (generated)
└── package.json
```

## 🎨 Key Features

### Currency Handling
- IDR/USD support in item forms
- Automatic formatting with thousand separators
- Input validation and parsing utilities

### Data Management
- Sample data for testing and demonstration
- Empty state handling across all modules
- Safe data access with optional chaining
- Multiple fallback values for critical fields

### UI/UX
- Dark glassmorphism theme
- Responsive design
- Smooth animations with Framer Motion
- Interactive charts and visualizations
- Status badges and color coding

## 🔧 Configuration

### Build Configuration
The project uses Vite with the following configuration:
- Output directory: `dist/`
- Base URL: `/`
- React plugin with Fast Refresh
- TailwindCSS for styling

### Environment Variables
No environment variables required for base deployment.

## 📊 Sample Data

The application includes sample data for:
- 2 Quotations (QT-2025-001, QT-2025-002)
- 3 Inbound transactions
- 1 Outbound transaction
- 1 Reject transaction
- Warehouse inventory samples
- Customer and vendor records

## 🚦 Production Readiness

All Portal Pabean components have been verified for:
- ✅ Empty data handling
- ✅ Safe field access
- ✅ Dynamic data operations
- ✅ Search functionality
- ✅ No crashes with missing data

## 📝 License

This project is private and proprietary.

## 👥 Author

FreightOne Development Team

---

**Ready for deployment!** 🚀
