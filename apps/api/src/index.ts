import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';
import { auditMiddleware } from './middleware/audit';
import { errorHandler } from './middleware/error';
import { rateLimit } from './middleware/rateLimit';
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import materialsRouter from './routes/materials';
import suppliersRouter from './routes/suppliers';
import customersRouter from './routes/customers';
import locationsRouter from './routes/locations';
import inventoryRouter from './routes/inventory';
import purchaseOrdersRouter from './routes/purchaseOrders';
import salesOrdersRouter from './routes/salesOrders';
import manufacturingRouter from './routes/manufacturing';
import stockOpsRouter from './routes/stockOps';
import apiKeysRouter from './routes/apiKeys';
import webhooksRouter from './routes/webhooks';
import dashboardRouter from './routes/dashboard';
import taxRatesRouter from './routes/taxRates';
import supplierAddressesRouter from './routes/supplierAddresses';
import customerAddressesRouter from './routes/customerAddresses';
import priceListsRouter from './routes/priceLists';
import servicesRouter from './routes/services';
import salesReturnsRouter from './routes/salesReturns';
import shippingFeesRouter from './routes/shippingFees';
import demandForecastRouter from './routes/demandForecast';
import factoryRouter from './routes/factory';
import currenciesRouter from './routes/currencies';
import accountingRouter from './routes/accounting';
import ecommerceRouter from './routes/ecommerce';
import barcodesRouter from './routes/barcodes';
import customFieldsRouter from './routes/customFields';
import batchesRouter from './routes/batches';
import serialNumbersRouter from './routes/serialNumbers';
import binLocationsRouter from './routes/binLocations';
import usersRouter from './routes/users';
import additionalCostsRouter from './routes/additionalCosts';
import outsourcedPORouter from './routes/outsourcedPO';
import accountingMetadataRouter from './routes/accountingMetadata';
import quotesRouter from './routes/quotes';
import insightsRouter from './routes/insights';
import planningRouter from './routes/planning';
import attachmentsRouter from './routes/attachments';
import variantsRouter from './routes/variants';
import operatorsRouter from './routes/operators';
import salesOrderRowsRouter from './routes/salesOrderRows';
import salesOrderFulfillmentsRouter from './routes/salesOrderFulfillments';
import purchaseOrderRowsRouter from './routes/purchaseOrderRows';
import serialNumberStockRouter from './routes/serialNumberStock';
import dataImportExportRouter from './routes/dataImportExport';
import pdfRouter from './routes/pdf';
import uploadRouter from './routes/upload';
import moProductionsRouter from './routes/moProductions';
import soAddressesRouter from './routes/soAddresses';
import salesReturnRowsRouter from './routes/salesReturnRows';
import priceListRowsRouter from './routes/priceListRows';
import priceListCustomersRouter from './routes/priceListCustomers';
import moProductionIngredientsRouter from './routes/moProductionIngredients';
import moRecipeRowsRouter from './routes/moRecipeRows';
import moOperationRowsRouter from './routes/moOperationRows';
import inventoryMovementsRouter from './routes/inventoryMovements';
import stocktakeRowsRouter from './routes/stocktakeRows';
import variantBinsRouter from './routes/variantBins';
import recipesRouter from './routes/recipes';
import bomRowsRouter from './routes/bomRows';
import productOperationsRouter from './routes/productOperations';
import { initStorage } from './lib/storage';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGINS.split(',').map(s => s.trim()), credentials: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(rateLimit({ max: 100, windowMs: 60_000 }));
app.use(auditMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'ForgeERP' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'ForgeERP API', version: '1.0.0', description: 'Manufacturing ERP REST API' },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/routes/*.js'],
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const v1 = '/api/v1';
app.use(`${v1}/auth`, authRouter);
app.use(`${v1}/products`, productsRouter);
app.use(`${v1}/materials`, materialsRouter);
app.use(`${v1}/suppliers`, suppliersRouter);
app.use(`${v1}/customers`, customersRouter);
app.use(`${v1}/locations`, locationsRouter);
app.use(`${v1}/inventory`, inventoryRouter);
app.use(`${v1}/purchase-orders`, purchaseOrdersRouter);
app.use(`${v1}/sales-orders`, salesOrdersRouter);
app.use(`${v1}/manufacturing`, manufacturingRouter);
app.use(`${v1}/stock`, stockOpsRouter);
app.use(`${v1}/api-keys`, apiKeysRouter);
app.use(`${v1}/webhooks`, webhooksRouter);
app.use(`${v1}/dashboard`, dashboardRouter);
app.use(`${v1}/tax-rates`, taxRatesRouter);
app.use(v1, supplierAddressesRouter);
app.use(v1, customerAddressesRouter);
app.use(`${v1}/price-lists`, priceListsRouter);
app.use(`${v1}/services`, servicesRouter);
app.use(`${v1}/sales-returns`, salesReturnsRouter);
app.use(v1, shippingFeesRouter);
app.use(`${v1}/demand-forecast`, demandForecastRouter);
app.use(`${v1}/factory`, factoryRouter);
app.use(`${v1}/currencies`, currenciesRouter);
app.use(`${v1}/accounting`, accountingRouter);
app.use(`${v1}/ecommerce`, ecommerceRouter);
app.use(`${v1}/barcodes`, barcodesRouter);
app.use(`${v1}/custom-fields`, customFieldsRouter);
app.use(`${v1}/batches`, batchesRouter);
app.use(`${v1}/serial-numbers`, serialNumbersRouter);
app.use(`${v1}/bin-locations`, binLocationsRouter);
app.use(`${v1}/users`, usersRouter);
app.use(`${v1}/additional-costs`, additionalCostsRouter);
app.use(`${v1}/outsourced-po-recipe-rows`, outsourcedPORouter);
app.use(`${v1}/accounting-metadata`, accountingMetadataRouter);
app.use(`${v1}/quotes`, quotesRouter);
app.use(`${v1}/insights`, insightsRouter);
app.use(`${v1}/planning`, planningRouter);
app.use(`${v1}/attachments`, attachmentsRouter);
app.use(`${v1}/variants`, variantsRouter);
app.use(`${v1}/operators`, operatorsRouter);
app.use(`${v1}/sales-order-rows`, salesOrderRowsRouter);
app.use(`${v1}/sales-order-fulfillments`, salesOrderFulfillmentsRouter);
app.use(`${v1}/purchase-order-rows`, purchaseOrderRowsRouter);
app.use(`${v1}/serial-number-stock`, serialNumberStockRouter);
app.use(`${v1}/data`, dataImportExportRouter);
app.use(`${v1}/pdf`, pdfRouter);
app.use(`${v1}/upload`, uploadRouter);
app.use(`${v1}/mo-productions`, moProductionsRouter);
app.use(`${v1}/so-addresses`, soAddressesRouter);
app.use(`${v1}/sales-return-rows`, salesReturnRowsRouter);
app.use(`${v1}/price-list-rows`, priceListRowsRouter);
app.use(`${v1}/price-list-customers`, priceListCustomersRouter);
app.use(`${v1}/mo-production-ingredients`, moProductionIngredientsRouter);
app.use(`${v1}/mo-recipe-rows`, moRecipeRowsRouter);
app.use(`${v1}/mo-operation-rows`, moOperationRowsRouter);
app.use(`${v1}/inventory-movements`, inventoryMovementsRouter);
app.use(`${v1}/stocktake-rows`, stocktakeRowsRouter);
app.use(`${v1}/variant-bins`, variantBinsRouter);
app.use(`${v1}/recipes`, recipesRouter);
app.use(`${v1}/bom-rows`, bomRowsRouter);
app.use(`${v1}/product-operations`, productOperationsRouter);

app.use(errorHandler);

initStorage().catch(err => console.warn('MinIO not available:', err.message));

app.listen(env.PORT, () => console.log(`ForgeERP API running on port ${env.PORT}`));

export default app;
