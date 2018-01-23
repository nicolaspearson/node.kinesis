export default class ArrayUtils {
	public static groupBy(list: any[], keyGetter: (item: any) => string) {
		return list.reduce((newArray, value) => {
			const key = keyGetter(value);
			(newArray[value[key]] = newArray[value[key]] || []).push(value);
			return newArray;
		});
	}

	public static mapGroupBy(list: any[], keyGetter: (item: any) => {}) {
		const map = new Map();
		list.forEach(item => {
			const key = keyGetter(item);
			const collection = map.get(key);
			if (!collection) {
				map.set(key, [item]);
			} else {
				collection.push(item);
			}
		});
		return map;
	}
}
