/**
 * Функция для расчета прибыли от одной позиции в чеке
 * @param {Object} purchase - товарная позиция из чека
 * @param {Object} product - карточка товара
 * @returns {number} прибыль от позиции
 */
function calculateSimpleRevenue(purchase, product) {
    const discountedPrice = purchase.sale_price * (1 - (purchase.discount || 0) / 100);
    return (discountedPrice - product.purchase_price) * purchase.quantity;
}

/**
 * Функция для расчета бонуса продавца
 * @param {number} index - позиция в рейтинге (0 - лучший)
 * @param {number} total - общее количество продавцов
 * @param {Object} seller - объект с данными продавца
 * @returns {number} размер бонуса
 */
function calculateBonusByProfit(index, total, seller) {
    if (index === 0) return seller.profit * 0.15;
    if (index === 1 || index === 2) return seller.profit * 0.10;
    if (index === total - 1) return 0;
    return seller.profit * 0.05;
}

/**
 * Основная функция анализа данных
 * @param {Object} data - входные данные
 * @param {Object} options - опции расчета
 * @returns {Array} отчет по продавцам
 */
function analyzeSalesData(data, options) {
    if (!data) throw new Error("Неверная структура данных");
    if (!data.products || !Array.isArray(data.products)) throw new Error("Неверная структура данных");
    if (!data.sellers || !Array.isArray(data.sellers)) throw new Error("Неверная структура данных");
    if (!data.purchase_records || !Array.isArray(data.purchase_records)) throw new Error("Неверная структура данных");
    if (data.products.length === 0) throw new Error("Неверная структура данных");
    if (data.sellers.length === 0) throw new Error("Неверная структура данных");
    if (data.purchase_records.length === 0) throw new Error("Неверная структура данных");
    
 
    if (!options || typeof options.calculateRevenue !== 'function' || typeof options.calculateBonus !== 'function') {
        throw new Error("Неверные опции расчета");
    }

    const productsMap = new Map(data.products.map(p => [p.id, p]));
    const sellersMap = new Map(data.sellers.map(s => [s.id, {
        ...s,
        fullName: `${s.first_name} ${s.last_name}`
    }]));
    
    const sellersStats = {};
    data.sellers.forEach(seller => {
        sellersStats[seller.id] = {
            id: seller.id,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: 0,
            profit: 0,
            sales_count: 0,
            products_sold: {}
        };
    });
    
    data.purchase_records.forEach(record => {
        const sellerId = record.seller_id;
        const sellerStat = sellersStats[sellerId];
        
        if (!sellerStat) return;
        
        sellerStat.sales_count++;
        
        record.items.forEach(item => {
            const product = productsMap.get(item.product_id);
            if (!product) return;
            
            const profit = options.calculateRevenue(item, product);
            const discountedPrice = item.sale_price * (1 - (item.discount || 0) / 100);
            const revenue = discountedPrice * item.quantity;
            
            sellerStat.revenue += revenue;
            sellerStat.profit += profit;
           
            if (!sellerStat.products_sold[item.product_id]) {
                sellerStat.products_sold[item.product_id] = 0;
            }
            sellerStat.products_sold[item.product_id] += item.quantity;
        });
    });
    
    const sortedSellers = Object.values(sellersStats).sort((a, b) => b.profit - a.profit);
    
    sortedSellers.forEach((seller, index) => {
        seller.bonus = options.calculateBonus(index, sortedSellers.length, seller);
        
        seller.top_products = Object.entries(seller.products_sold)
            .map(([productId, quantity]) => ({
                productId: parseInt(productId),
                quantity
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10)
            .map(item => {
                const product = productsMap.get(item.productId);
                return product ? product.name : `Товар ${item.productId}`;
            });
    });
    
    return sortedSellers.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}